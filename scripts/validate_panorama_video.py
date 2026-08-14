#!/usr/bin/env python3
"""Validate an externally generated equirectangular panorama video.

Requires ffprobe on PATH. The script does not modify either media file.
"""
import argparse
import json
import subprocess
from pathlib import Path


def probe(path: Path) -> dict:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries",
            "format=duration:stream=index,codec_type,codec_name,width,height,pix_fmt,avg_frame_rate",
            "-of", "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def stream(data: dict, kind: str) -> dict | None:
    return next((item for item in data.get("streams", []) if item.get("codec_type") == kind), None)


def frame_rate(value: str | None) -> float:
    if not value or value == "0/0":
        return 0
    numerator, denominator = value.split("/", 1)
    return float(numerator) / float(denominator)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Generated 360 MP4")
    parser.add_argument("--source", required=True, type=Path, help="Original perspective MP4")
    parser.add_argument("--duration-tolerance", type=float, default=0.08)
    parser.add_argument("--fps-tolerance", type=float, default=0.01)
    args = parser.parse_args()

    for path in (args.source, args.output):
        if not path.is_file() or path.stat().st_size == 0:
            parser.error(f"Media file is missing or empty: {path}")

    source_data = probe(args.source)
    output_data = probe(args.output)
    source_video = stream(source_data, "video")
    output_video = stream(output_data, "video")
    output_audio = stream(output_data, "audio")

    failures: list[str] = []
    if not source_video:
        failures.append("source has no video stream")
    if not output_video:
        failures.append("output has no video stream")
    else:
        width = int(output_video.get("width", 0))
        height = int(output_video.get("height", 0))
        if (width, height) != (2048, 1024):
            failures.append(f"expected 2048x1024, got {width}x{height}")
        if width != height * 2:
            failures.append("output is not exactly 2:1 equirectangular")
        if output_video.get("codec_name") != "h264":
            failures.append(f"expected h264, got {output_video.get('codec_name')}")
        if output_video.get("pix_fmt") != "yuv420p":
            failures.append(f"expected yuv420p, got {output_video.get('pix_fmt')}")

    if not output_audio:
        failures.append("output has no original audio stream")
    elif output_audio.get("codec_name") != "aac":
        failures.append(f"expected AAC audio, got {output_audio.get('codec_name')}")

    source_duration = float(source_data.get("format", {}).get("duration", 0))
    output_duration = float(output_data.get("format", {}).get("duration", 0))
    if abs(source_duration - output_duration) > args.duration_tolerance:
        failures.append(
            f"duration differs: source={source_duration:.3f}s output={output_duration:.3f}s"
        )

    if source_video and output_video:
        source_fps = frame_rate(source_video.get("avg_frame_rate"))
        output_fps = frame_rate(output_video.get("avg_frame_rate"))
        if abs(source_fps - output_fps) > args.fps_tolerance:
            failures.append(f"frame rate differs: source={source_fps:.3f} output={output_fps:.3f}")

    if failures:
        print("Panorama video validation failed:")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print(
        f"OK: 2048x1024 H.264/AAC, {output_duration:.3f}s, "
        f"{frame_rate(output_video.get('avg_frame_rate')):.3f} fps"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
