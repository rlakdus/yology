#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOCK_FILE="${PROJECT_ROOT}/gpu360/argus.lock.json"
PATCH_FILE="${PROJECT_ROOT}/gpu360/patches/argus-save-camera-metadata.patch"
ARGUS_DIR="${ARGUS_DIR:-${PROJECT_ROOT}/.gpu360/argus-code}"

read_lock() {
  python3 - "${LOCK_FILE}" "$1" <<'PY'
import json
import sys

data = json.load(open(sys.argv[1], encoding="utf-8"))
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

if git -C "${ARGUS_DIR}" apply --unidiff-zero --reverse --check "${PATCH_FILE}" >/dev/null 2>&1; then
  CURRENT_COMMIT="$(git -C "${ARGUS_DIR}" rev-parse HEAD)"
  if [[ "${CURRENT_COMMIT}" != "${ARGUS_COMMIT}" ]]; then
    echo "패치된 Argus가 lock과 다른 커밋에 있습니다: ${CURRENT_COMMIT}" >&2
    exit 1
  fi
  UNKNOWN_CHANGES="$(git -C "${ARGUS_DIR}" status --porcelain | grep -v '^ M inference.py$' || true)"
  if [[ -n "${UNKNOWN_CHANGES}" ]]; then
    echo "카메라 패치 외의 Argus 변경이 있어 중단합니다:" >&2
    echo "${UNKNOWN_CHANGES}" >&2
    exit 1
  fi
  git -C "${ARGUS_DIR}" submodule sync --recursive
  git -C "${ARGUS_DIR}" submodule update --init --recursive
  echo "카메라 메타데이터 패치가 이미 적용되어 있습니다."
  echo "Argus 준비 완료"
  echo "  경로: ${ARGUS_DIR}"
  echo "  커밋: ${ARGUS_COMMIT}"
  exit 0
fi

if [[ -n "$(git -C "${ARGUS_DIR}" status --porcelain)" ]]; then
  echo "알 수 없는 Argus 작업 트리 변경이 있어 중단합니다: ${ARGUS_DIR}" >&2
  exit 1
fi

git -C "${ARGUS_DIR}" fetch origin "${ARGUS_COMMIT}"
git -C "${ARGUS_DIR}" checkout --detach "${ARGUS_COMMIT}"
git -C "${ARGUS_DIR}" submodule sync --recursive
git -C "${ARGUS_DIR}" submodule update --init --recursive

if git -C "${ARGUS_DIR}" apply --unidiff-zero --check "${PATCH_FILE}"; then
  git -C "${ARGUS_DIR}" apply --unidiff-zero "${PATCH_FILE}"
else
  echo "고정된 Argus 커밋에 패치를 적용할 수 없습니다." >&2
  exit 1
fi

echo "Argus 준비 완료"
echo "  경로: ${ARGUS_DIR}"
echo "  커밋: ${ARGUS_COMMIT}"
echo
echo "다음 단계: docs/gpu_360_video_generation.md의 Conda 환경과 체크포인트 설정을 완료하세요."
