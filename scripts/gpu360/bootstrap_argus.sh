#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCK_FILE="${PROJECT_ROOT}/gpu360/argus.lock.json"
ARGUS_PATCH_FILES=(
  "${PROJECT_ROOT}/gpu360/patches/argus-save-camera-metadata.patch"
  "${PROJECT_ROOT}/gpu360/patches/argus-fixed-fov-aspect.patch"
  "${PROJECT_ROOT}/gpu360/patches/argus-fp16-runtime.patch"
  "${PROJECT_ROOT}/gpu360/patches/argus-reset-batch-conditioning.patch"
)
VENHANCER_PATCH_FILES=(
  "${PROJECT_ROOT}/gpu360/patches/venhancer-portable-ffmpeg.patch"
  "${PROJECT_ROOT}/gpu360/patches/venhancer-configurable-max-resolution.patch"
  "${PROJECT_ROOT}/gpu360/patches/venhancer-tiled-vae-encode.patch"
)
ARGUS_DIR="${ARGUS_DIR:-${PROJECT_ROOT}/.gpu360/argus-code}"

read_lock() {
  python3 - "${LOCK_FILE}" "$1" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as stream:
    data = json.load(stream)
print(data[sys.argv[2]])
PY
}

ARGUS_REPOSITORY="$(read_lock repository)"
ARGUS_COMMIT="$(read_lock commit)"

for command in git python3; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: ${command}" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "${ARGUS_DIR}")"
if [[ ! -d "${ARGUS_DIR}/.git" ]]; then
  if [[ -e "${ARGUS_DIR}" ]]; then
    echo "Argus 경로가 비어 있지 않고 Git 저장소도 아닙니다: ${ARGUS_DIR}" >&2
    exit 1
  fi
  git clone --recurse-submodules "${ARGUS_REPOSITORY}" "${ARGUS_DIR}"
fi

CURRENT_COMMIT="$(git -C "${ARGUS_DIR}" rev-parse HEAD)"
if [[ "${CURRENT_COMMIT}" != "${ARGUS_COMMIT}" ]]; then
  if [[ -n "$(git -C "${ARGUS_DIR}" status --porcelain)" ]]; then
    echo "Argus가 lock과 다른 커밋이며 작업 트리 변경도 있어 중단합니다: ${CURRENT_COMMIT}" >&2
    exit 1
  fi
  git -C "${ARGUS_DIR}" fetch origin "${ARGUS_COMMIT}"
  git -C "${ARGUS_DIR}" checkout --detach "${ARGUS_COMMIT}"
fi

ARGUS_UNKNOWN_CHANGES="$(
  git -C "${ARGUS_DIR}" status --porcelain |
    grep -v '^ M inference.py$' |
    grep -v '^ M src/sampling_svd.py$' |
    grep -Ev '^ [mM] venhancer$' || true
)"
if [[ -n "${ARGUS_UNKNOWN_CHANGES}" ]]; then
  echo "관리되는 패치 외의 Argus 변경이 있어 중단합니다:" >&2
  echo "${ARGUS_UNKNOWN_CHANGES}" >&2
  exit 1
fi

argus_patch_is_applied() {
  case "$(basename "$1")" in
    argus-save-camera-metadata.patch)
      [[ "$(grep -c 'camera_metadata_path = out_file_path' "${ARGUS_DIR}/inference.py")" -eq 1 ]] &&
        [[ "$(grep -c '^import json$' "${ARGUS_DIR}/inference.py")" -eq 1 ]]
      ;;
    argus-fixed-fov-aspect.patch)
      grep -Fq 'hw_ratio = video.shape[-2] / video.shape[-1]' "${ARGUS_DIR}/inference.py"
      ;;
    argus-fp16-runtime.patch)
      grep -Fq "Accelerator(mixed_precision='fp16')" "${ARGUS_DIR}/inference.py" &&
        grep -Fq 'weight_dtype = torch.float16' "${ARGUS_DIR}/inference.py" &&
        grep -Fq 'torch_dtype=weight_dtype,' "${ARGUS_DIR}/inference.py"
      ;;
    argus-reset-batch-conditioning.patch)
      grep -Fq "parser.add_argument('--reset_batch_conditioning'" "${ARGUS_DIR}/inference.py" &&
        grep -Fq "getattr(args, 'reset_batch_conditioning', False)" "${ARGUS_DIR}/src/sampling_svd.py"
      ;;
    *) return 1 ;;
  esac
}

for patch_file in "${ARGUS_PATCH_FILES[@]}"; do
  if argus_patch_is_applied "${patch_file}"; then
    echo "패치 적용 확인: $(basename "${patch_file}")"
  elif git -C "${ARGUS_DIR}" apply --unidiff-zero --check "${patch_file}" >/dev/null 2>&1; then
    git -C "${ARGUS_DIR}" apply --unidiff-zero "${patch_file}"
    echo "패치 적용 완료: $(basename "${patch_file}")"
  else
    echo "고정된 Argus 커밋에 패치를 적용하거나 확인할 수 없습니다: ${patch_file}" >&2
    exit 1
  fi
done

git -C "${ARGUS_DIR}" submodule sync --recursive
git -C "${ARGUS_DIR}" submodule update --init --recursive

VENHANCER_DIR="${ARGUS_DIR}/venhancer"
VENHANCER_UNKNOWN_CHANGES="$(
  git -C "${VENHANCER_DIR}" status --porcelain |
    grep -v '^ M inference_utils.py$' |
    grep -v '^ M video_to_video/video_to_video_model.py$' || true
)"
if [[ -n "${VENHANCER_UNKNOWN_CHANGES}" ]]; then
  echo "관리되는 FFmpeg 패치 외의 VEnhancer 변경이 있어 중단합니다:" >&2
  echo "${VENHANCER_UNKNOWN_CHANGES}" >&2
  exit 1
fi

venhancer_patch_is_applied() {
  case "$(basename "$1")" in
    venhancer-portable-ffmpeg.patch)
      grep -Fq 'os.environ.get("FFMPEG_PATH", "ffmpeg")' "${VENHANCER_DIR}/inference_utils.py"
      ;;
    venhancer-configurable-max-resolution.patch)
      grep -Fq 'os.environ.get("VENHANCER_MAX_PIXELS", 1152 * 2048)' "${VENHANCER_DIR}/inference_utils.py"
      ;;
    venhancer-tiled-vae-encode.patch)
      grep -Fq 'def tiled_vae_encode(self, t):' "${VENHANCER_DIR}/video_to_video/video_to_video_model.py"
      ;;
    *) return 1 ;;
  esac
}

for patch_file in "${VENHANCER_PATCH_FILES[@]}"; do
  if venhancer_patch_is_applied "${patch_file}"; then
    echo "패치 적용 확인: $(basename "${patch_file}")"
  elif git -C "${VENHANCER_DIR}" apply --unidiff-zero --check "${patch_file}" >/dev/null 2>&1; then
    git -C "${VENHANCER_DIR}" apply --unidiff-zero "${patch_file}"
    echo "패치 적용 완료: $(basename "${patch_file}")"
  else
    echo "고정된 VEnhancer 커밋에 패치를 적용하거나 확인할 수 없습니다: ${patch_file}" >&2
    exit 1
  fi
done

echo "Argus 준비 완료"
echo "  경로: ${ARGUS_DIR}"
echo "  커밋: ${ARGUS_COMMIT}"
echo
echo "다음 단계: docs/gpu_360_video_generation.md의 Conda 환경과 체크포인트 설정을 완료하세요."
