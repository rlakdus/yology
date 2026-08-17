#!/usr/bin/env python3
"""Render a procedural audio bed for a 360 event from a JSON layer spec.

Nothing here is sampled material: every layer is synthesised from oscillators
and shaped noise, so the result carries no licensing constraints and is
reproducible from the spec alone. Loudness is matched to the same EBU R128
target the recorded events are normalised to.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import wave
from pathlib import Path
from typing import Any

import numpy as np

SAMPLE_RATE = 48000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--spec", required=True, type=Path, help="레이어 사양 JSON")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--duration",
        type=float,
        help="사양의 duration_seconds를 덮어씁니다. 파이프라인이 영상 길이를 그대로 넘길 때 사용합니다.",
    )
    parser.add_argument("--target-lufs", type=float, default=-18.0)
    parser.add_argument("--true-peak-db", type=float, default=-1.0)
    parser.add_argument(
        "--channels",
        type=int,
        choices=(1, 2),
        default=2,
        help="믹스 자체는 모노다. 웹으로 바로 내보내는 파일은 1을 써서 크기를 절반으로 줄인다.",
    )
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def curve(points: list[list[float]], t: np.ndarray) -> np.ndarray:
    """키프레임 [[초, 값], ...]을 선형 보간합니다. 양끝은 그대로 유지됩니다."""
    if not points:
        raise SystemExit("커브에 키프레임이 없습니다.")
    times = np.array([float(p[0]) for p in points])
    values = np.array([float(p[1]) for p in points])
    order = np.argsort(times)
    return np.interp(t, times[order], values[order])


def band_noise(n: int, low_hz: float, high_hz: float, rng: np.random.Generator) -> np.ndarray:
    """FFT로 대역을 잘라낸 노이즈. 공기감·쉬머 레이어의 재료입니다."""
    noise = rng.normal(0.0, 1.0, n)
    spectrum = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(n, 1.0 / SAMPLE_RATE)
    spectrum[(freqs < low_hz) | (freqs > high_hz)] = 0.0
    filtered = np.fft.irfft(spectrum, n)
    peak = np.max(np.abs(filtered))
    return filtered / peak if peak > 0 else filtered


def thump(samples: int, start_hz: float, end_hz: float, decay: float, noise_amount: float,
          rng: np.random.Generator) -> np.ndarray:
    """아래로 미끄러지는 사인 + 짧은 노이즈 트랜지언트 = 가슴을 치는 한 방."""
    t = np.arange(samples) / SAMPLE_RATE
    sweep = start_hz + (end_hz - start_hz) * (t / t[-1])
    body = np.sin(2 * np.pi * np.cumsum(sweep) / SAMPLE_RATE)
    transient = rng.normal(0.0, 1.0, samples) * noise_amount * np.exp(-t * decay * 3.0)
    return (body + transient) * np.exp(-t * decay)


def render_heartbeat(layer: dict[str, Any], t: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """bpm 커브를 적분해 박동 위치를 정하고, 박마다 lub-dub 두 방을 찍습니다."""
    out = np.zeros(len(t) + SAMPLE_RATE)
    bpm = curve(layer["bpm"], t)
    gain = curve(layer.get("gain", [[0, 1.0]]), t)
    jitter = float(layer.get("jitter", 0.015))

    # 박자 위상 = bpm/60의 누적적분. 정수를 넘어설 때마다 한 박.
    phase = np.cumsum(bpm / 60.0) / SAMPLE_RATE
    beats = np.flatnonzero(np.diff(np.floor(phase)) > 0) + 1

    lub_len = int(0.28 * SAMPLE_RATE)
    dub_len = int(0.22 * SAMPLE_RATE)
    for index in beats:
        offset = int(rng.normal(0.0, jitter) * SAMPLE_RATE)
        start = max(0, index + offset)
        level = gain[min(index, len(gain) - 1)]
        lub = thump(lub_len, 62.0, 34.0, 17.0, 0.06, rng) * level
        dub = thump(dub_len, 54.0, 30.0, 22.0, 0.05, rng) * level * 0.62
        gap = start + int(0.17 * SAMPLE_RATE)
        out[start:start + lub_len] += lub
        out[gap:gap + dub_len] += dub
    return out[:len(t)]


def render_drone(layer: dict[str, Any], t: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """살짝 어긋난 두 사인의 맥놀이. 해소 구간에서 base_hz가 이동할 수 있습니다."""
    base = curve(layer["base_hz"], t) if isinstance(layer["base_hz"], list) else np.full_like(t, float(layer["base_hz"]))
    detune = float(layer.get("detune_hz", 0.3))
    gain = curve(layer.get("gain", [[0, 1.0]]), t)
    a = np.sin(2 * np.pi * np.cumsum(base) / SAMPLE_RATE)
    b = np.sin(2 * np.pi * np.cumsum(base + detune) / SAMPLE_RATE)
    harmonic = np.sin(2 * np.pi * np.cumsum(base * 2.0) / SAMPLE_RATE) * float(layer.get("harmonic", 0.0))
    return (a + b + harmonic) / 2.0 * gain


def render_air(layer: dict[str, Any], t: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """대역 제한 노이즈. 방의 공기를 흉내내지 않고 추상적인 긴장만 얹습니다."""
    noise = band_noise(len(t), float(layer.get("low_hz", 2000)), float(layer.get("high_hz", 9000)), rng)
    return noise * curve(layer.get("gain", [[0, 1.0]]), t)


def render_swell(layer: dict[str, Any], t: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """한 시점에서 피어올랐다 사라지는 일회성 블룸. 전환점을 표시합니다."""
    at = float(layer["at_seconds"])
    rise = float(layer.get("rise_seconds", 0.6))
    fall = float(layer.get("fall_seconds", 1.8))
    local = t - at
    envelope = np.where(
        local < 0,
        np.exp(-((local / max(rise, 1e-6)) ** 2) * 4.0),
        np.exp(-local / max(fall, 1e-6)),
    )
    envelope[t < at - rise * 3] = 0.0
    tone = band_noise(len(t), float(layer.get("low_hz", 300)), float(layer.get("high_hz", 4000)), rng)
    base = float(layer.get("base_hz", 220.0))
    tone = tone * 0.5 + np.sin(2 * np.pi * base * t) * 0.5
    return tone * envelope * float(layer.get("gain", 1.0))


RENDERERS = {
    "heartbeat": render_heartbeat,
    "drone": render_drone,
    "air": render_air,
    "swell": render_swell,
}


def render_bed(spec: dict[str, Any], duration: float) -> np.ndarray:
    total = int(round(duration * SAMPLE_RATE))
    if total < SAMPLE_RATE // 2:
        raise SystemExit(f"베드 길이가 너무 짧습니다: {duration}초")
    t = np.arange(total) / SAMPLE_RATE
    mix = np.zeros(total)
    layers = spec.get("layers", [])
    if not layers:
        raise SystemExit("사양에 layers가 없습니다.")

    for index, layer in enumerate(layers):
        kind = layer.get("type")
        renderer = RENDERERS.get(kind)
        if renderer is None:
            raise SystemExit(f"알 수 없는 레이어 유형입니다: {kind}")
        # 레이어마다 시드를 갈라 두면 한 레이어를 바꿔도 나머지 난수가 흔들리지 않습니다.
        rng = np.random.default_rng(int(spec.get("seed", 0)) * 1000 + index)
        mix += renderer(layer, t, rng) * float(layer.get("level", 1.0))
        print(f"  레이어 {index} ({kind}) 렌더링 완료", flush=True)

    fade = int(float(spec.get("fade_seconds", 0.25)) * SAMPLE_RATE)
    if fade > 0 and total > fade * 2:
        ramp = np.linspace(0.0, 1.0, fade)
        mix[:fade] *= ramp
        mix[-fade:] *= ramp[::-1]

    peak = np.max(np.abs(mix))
    if peak == 0:
        raise SystemExit("믹스가 무음입니다. 레이어 게인을 확인하세요.")
    return mix / peak * 0.89


def write_wave(path: Path, mono: np.ndarray, channels: int = 2) -> None:
    frames = mono if channels == 1 else np.stack([mono, mono], axis=1)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(channels)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes((frames * 32767).astype(np.int16).tobytes())


def measure_loudness(path: Path, target_lufs: float, true_peak_db: float) -> dict[str, str]:
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
            "-af", f"loudnorm=I={target_lufs}:TP={true_peak_db}:LRA=11:print_format=json",
            "-f", "null", "-",
        ],
        capture_output=True, text=True, check=True,
    )
    start = result.stderr.rfind("{")
    end = result.stderr.rfind("}")
    if start < 0 or end < 0:
        raise SystemExit("loudnorm 측정 결과를 읽지 못했습니다.")
    return json.loads(result.stderr[start:end + 1])


def normalise(path: Path, target_lufs: float, true_peak_db: float, channels: int = 2) -> None:
    """2-pass loudnorm. 녹음 이벤트와 같은 기준으로 맞춰야 이동 시 음량이 튀지 않습니다."""
    measured = measure_loudness(path, target_lufs, true_peak_db)
    temporary = path.with_suffix(".normalising.wav")
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
            "-af",
            f"loudnorm=I={target_lufs}:TP={true_peak_db}:LRA=11"
            f":measured_I={measured['input_i']}"
            f":measured_TP={measured['input_tp']}"
            f":measured_LRA={measured['input_lra']}"
            f":measured_thresh={measured['input_thresh']}"
            ":linear=true",
            "-ar", str(SAMPLE_RATE), "-ac", str(channels), "-c:a", "pcm_s16le", str(temporary),
        ],
        check=True,
    )
    temporary.replace(path)


def main() -> int:
    args = parse_args()
    if args.output.exists() and not args.force:
        raise SystemExit(f"출력이 이미 있습니다. 덮어쓰려면 --force를 사용하세요: {args.output}")

    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    duration = args.duration if args.duration is not None else spec.get("duration_seconds")
    if duration is None:
        raise SystemExit("--duration 또는 사양의 duration_seconds가 필요합니다.")

    print(f"사운드 베드를 렌더링합니다: {duration:.3f}초, 레이어 {len(spec.get('layers', []))}개")
    write_wave(args.output, render_bed(spec, float(duration)), args.channels)
    normalise(args.output, args.target_lufs, args.true_peak_db, args.channels)
    print(f"완료: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
