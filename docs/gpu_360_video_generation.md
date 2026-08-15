# GPU 360° 영상 생성 실행 가이드

이 브랜치는 일반 1인칭 영상을 모노 equirectangular 360° 영상으로 만드는 외부
CUDA 작업을 재현 가능하게 전달한다. 웹 애플리케이션은 GPU 작업을 수행하지 않으며,
완성된 MP4만 이벤트 디렉터리에서 읽는다.

## 추적하는 것과 제외하는 것

Git에 포함되는 항목:

- 고정된 Argus 저장소·커밋·서브모듈 정보
- 이벤트별 원본 SHA-256과 생성 옵션
- Argus 실행, 카메라 메타데이터 저장, 원본 정면 재투영, 검증 코드
- 완료 후 모델·옵션·출력 SHA-256을 기록하는 `generation.json`

Git에서 제외되는 항목:

- `.gpu360/` 아래의 Argus 사본, Conda 캐시와 체크포인트
- `gpu360/work/` 아래의 생성·향상·합성 중간 파일

Argus는 MIT 라이선스의 외부 프로젝트이며 이 저장소에 소스를 복사하지 않는다.
`gpu360/argus.lock.json`에 고정한 커밋을 GPU 작업자가 직접 clone한다.

## 1. 요구 환경

- Linux와 NVIDIA CUDA GPU
- Git, Conda, FFmpeg/ffprobe
- 체크포인트 및 중간 영상에 충분한 로컬 저장 공간

다음 명령으로 고정된 Argus와 서브모듈을 내려받고, 카메라 자세 기록용 작은 패치를
적용한다.

```bash
bash scripts/gpu360/bootstrap_argus.sh
```

기본 설치 위치는 `.gpu360/argus-code`다. 다른 디스크를 쓰려면 같은 경로를 이후
실행기에도 전달한다.

```bash
ARGUS_DIR=/mnt/fast/argus-code bash scripts/gpu360/bootstrap_argus.sh
```

## 2. Conda 환경

공식 Argus 구조처럼 생성·카메라 추정과 영상 향상을 분리한다. PyTorch 설치 명령은
GPU 드라이버와 CUDA 버전에 따라 달라지므로 작업자가 PyTorch 공식 선택기를 이용해
각 환경에 맞는 빌드를 먼저 설치해야 한다.

### `360VG`: Argus 생성과 MASt3R 카메라 추정

```bash
conda create -n 360VG python=3.10 -y
conda activate 360VG
pip install "numpy<2"
# 이 위치에서 CUDA에 맞는 torch와 torchvision을 설치한다.
pip install -r .gpu360/argus-code/requirements.txt
conda install -c pytorch -c nvidia faiss-gpu=1.8.0 -y

git clone https://github.com/jenicek/asmk .gpu360/asmk
cd .gpu360/asmk/cython
cythonize *.pyx
cd ..
pip install . --no-build-isolation
cd ../..
```

### `venhancer`: 1024×512 → 2048×1024 향상

```bash
conda create -n venhancer python=3.10 -y
conda activate venhancer
# 이 위치에서 CUDA에 맞는 torch를 설치한다.
pip install -r .gpu360/argus-code/venhancer/requirements.txt
```

Argus 공식 README가 제공하는 pretrained UNet을 내려받는다. `--unet`에는 내부에
`unet/` 하위 폴더가 있는 체크포인트 루트를 지정한다. MASt3R와 VEnhancer 모델은
첫 실행 중 Hugging Face에서 내려받을 수 있으므로 GPU 서버의 네트워크와 캐시 용량도
확인한다.

## 3. 작업 설정 확인

GPU 없이도 원본 경로와 SHA-256, 출력 규칙을 확인할 수 있다.

```bash
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student-event_003.json \
  --check-config
```

등록된 작업:

| 설정 | 원본 | 예정 출력 |
| --- | --- | --- |
| `student-event_001.json` | 면접 결과 확인 | `exam-interview-360.mp4` |
| `student-event_003.json` | 몽골 승마 | `mongolia-horse-360.mp4` |
| `student-event_004.json` | 영화 관람 | `favorite-movie-360.mp4` |

## 4. 전체 파이프라인 실행

먼저 짧은 `event_003`으로 환경을 검증한다.

```bash
export ARGUS_UNET_PATH=/mnt/models/argus/checkpoint
export ARGUS_CHECKPOINT_ID=official-unet-checkpoint

python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student-event_003.json
```

실행기는 다음 순서를 보장한다.

1. 원본 SHA-256, CUDA, Conda 환경, ffmpeg를 검사한다.
2. ffprobe의 전체 프레임 수를 Argus `--num_frames`로 전달한다.
3. `--full_sampling` 한 작업 안에서 25프레임 배치와 4프레임 겹침을 사용한다.
4. VEnhancer로 2048×1024까지 2배 향상한다.
5. Argus가 사용한 FOV와 프레임별 roll/pitch/yaw로 원본 정면을 다시 투영한다.
6. 투영 가장자리 5%를 페더링하고 좌우 seam을 좁게 연결한다.
7. 원본 FPS와 오디오로 H.264 High Profile, yuv420p, AAC, faststart MP4를 만든다.
8. `validate_panorama_video.py` 통과 후 이벤트 출력과 생성 기록을 갱신한다.

긴 작업이 중단되면 완료된 단계 다음부터 재개할 수 있다.

```bash
# Argus 결과부터 향상 재개
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student-event_003.json \
  --from-stage enhance

# 합성 결과만 다시 검증·배치
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student-event_003.json \
  --from-stage validate
```

기존 최종 출력 또는 중간 합성 결과를 의도적으로 교체할 때만 `--force`를 사용한다.

## 5. 완료 후 검수

자동 검증은 해상도, 2:1 비율, H.264/yuv420p, AAC, FPS와 길이를 확인한다. 다음은
사람이 직접 확인해야 한다.

- 0°/360° seam에서 물체가 끊기거나 깜빡이지 않는가
- 25프레임 내부 배치 경계에서 시간적 점프가 없는가
- 정면 원본과 AI 생성 영역의 페더에 이중상이 없는가
- 고개를 돌렸을 때 상하 극점과 후면이 자연스러운가
- AI로 생성된 주변 시야가 실제 기록으로 오인되지 않게 표시되는가

완성 MP4는 크기를 확인한 뒤 Git LFS 또는 팀의 대용량 에셋 저장소를 사용한다.
체크포인트와 `gpu360/work`은 커밋하지 않는다.

`event_003` 메타데이터는 이미 생성될 `mongolia-horse-360.mp4`를 참조한다.
`event_001`과 `event_004`는 검수가 끝날 때까지 현재 원본 평면 영상을 유지하며,
검수 후 각 `metadata.json`에 `panorama_video`를 추가해 명시적으로 전환한다.
