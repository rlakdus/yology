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

다음 명령으로 고정된 Argus와 서브모듈을 내려받고, 고정 FOV 종횡비, 카메라 메타데이터 기록, 현재 Diffusers용 FP16 호환 패치를
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

공식 Argus 구조처럼 고정 시점 전처리·생성과 영상 향상을 분리한다. PyTorch 설치 명령은
GPU 드라이버와 CUDA 버전에 따라 달라지므로 작업자가 PyTorch 공식 선택기를 이용해
각 환경에 맞는 빌드를 먼저 설치해야 한다.

### `360VG`: 고정 시점 전처리와 Argus 생성

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

### `venhancer`: 1024×512 → 3072×1536 생성 향상

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
  --job gpu360/jobs/student/event_003.json \
  --check-config
```

등록된 작업:

| 설정 | 원본 | 출력 | 주변부 |
| --- | --- | --- | --- |
| `student/event_002.json` | 대학 입학 후 첫 콘서트 | `first-concert-360.mp4` | 고정 파노라마 이미지 |
| `student/event_003.json` | 몽골 승마 | `mongolia-horse-riding-360.mp4` | Argus 생성 |
| `student/event_004.json` | 영화 관람 | `favorite-movie-360.mp4` | 고정 파노라마 이미지 |

`event_002`는 원본을 10초로 자른 `*.trimmed.mov`를 쓴다. job의 `source_trim`에 원본
경로·SHA-256·구간과 자른 이유를 남긴다. 세로 원본이라 `input.fixed_fov_deg`도 90이 아닌
60이다 — 90이면 세로 화각이 121°가 되어 실제 폰 카메라 범위를 벗어나고 조명 트러스의
수직선이 배럴 왜곡된다.

## 4. 전체 파이프라인 실행

먼저 짧은 `event_003`으로 환경을 검증한다.

```bash
export ARGUS_UNET_PATH=/mnt/models/argus/checkpoint
export ARGUS_CHECKPOINT_ID=official-unet-checkpoint

python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student/event_003.json
```

실행기는 다음 순서를 보장한다.

1. 원본 SHA-256, CUDA, Conda 환경, ffmpeg를 검사한다.
2. 원본 종횡비를 보존하고 줌·롤을 상쇄한 고정 시점 영상을 준비한다.
3. ffprobe의 전체 프레임 수를 Argus `--num_frames`로 전달한다.
4. `--full_sampling` 한 작업 안에서 25프레임 배치와 4프레임 겹침을 사용한다. 각 배치는 이전 생성 파노라마가 아니라 해당 시점의 기록 프레임으로 다시 조건화해 누적 왜곡을 막는다.
5. VEnhancer의 타일 VAE 인코딩으로 3072×1536까지 3배 향상한다.
6. 생성 배경을 Lanczos로 4096×2048에 배치하고, 고정 FOV와 0° roll/pitch/yaw로 전처리한 정면은 원본 1280×720에서 곧바로 4K 좌표에 재투영한다.
7. 투영 가장자리 5%를 페더링하고 좌우 seam을 좁게 연결한다.
8. 원본 FPS와 오디오로 H.264 High Profile, yuv420p, AAC, faststart MP4를 만든다.
9. `validate_panorama_video.py` 통과 후 이벤트 출력과 생성 기록을 갱신한다.

긴 작업이 중단되면 완료된 단계 다음부터 재개할 수 있다.

```bash
# Argus 결과부터 향상 재개
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student/event_003.json \
  --from-stage enhance

# 합성 결과만 다시 검증·배치
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student/event_003.json \
  --from-stage validate
```

기존 최종 출력 또는 중간 합성 결과를 의도적으로 교체할 때만 `--force`를 사용한다.
`--to-stage`로 특정 단계까지만 실행할 수도 있다 (아래 고정 배경 방식에서 사용한다).

## 4-1. 생성 주변부가 실제 장소와 다를 때

Argus는 정면 FOV 밖의 모든 픽셀을 UNet에 넣기 전에 `-1`로 비운다
(`src/pers2equi.py`, `src/sampling_svd.py`). 즉 주변부는 **항상 상상해서 그리며**, 우리가
만든 파노라마를 시드로 넣을 수단이 없다. `--equirectangular_input`도 이 동작을 바꾸지
않는다. `event_004`(영화관)에서는 정면에 실제 극장 벽이 그대로 보이는데도 창문 있는
거실을 만들어냈다.

이럴 때는 주변부를 한 장의 파노라마 이미지로 만들어 **고정 배경**으로 쓰고, 정면만 실제
녹화 영상으로 재생한다.

```bash
# 1) 카메라 보정값만 얻으면 되므로 infer까지만 돌린다 (VEnhancer 생략)
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student/event_004.json --to-stage infer

# 2) 준비된 정면 첫 프레임에서 파노라마 이미지를 만든다
conda run -n 360VG python scripts/gpu360/generate_panorama_image.py \
  --argus-dir .gpu360/argus-code \
  --front-image <prepared 첫 프레임 PNG> \
  --fov-x-deg 90 --width 2048 --height 1024 --multi-view \
  --prompt "<장면에 맞는 환경 묘사>" \
  --output events/student/event_004/panorama/favorite-movie-360.background.png

# 3) job의 composite.frozen_panorama_image에 위 경로를 넣고 합성한다
python scripts/gpu360/run_pipeline.py \
  --job gpu360/jobs/student/event_004.json --from-stage compose
```

`composite.frozen_panorama_image`가 있으면 실행기는 enhance 단계를 건너뛰고(Argus 파노라마를
쓰지 않으므로) 이미지를 1프레임 영상으로 감싸 주변부로 고정한다.

`--multi-view`는 필수에 가깝다. SDXL에는 equirectangular 사전지식이 없어서 2:1 캔버스를
직접 채우게 하면 비어 있는 92.5%를 스튜디오 배경으로 해석해 검은 바탕에 물체만 그린다.
`--multi-view`는 주변부를 큐브 면 단위의 평범한 원근 이미지로 나눠 생성한 뒤
`pers2equi_batch`로 되돌려 붙이며, 정면에 가까운 면부터 채워 나가 각 면이 이미 채워진
이웃을 보고 그리도록 한다. 프롬프트는 반드시 장면에 맞게 바꾼다 — 극장용 프롬프트를
카페에 그대로 쓰면 안 된다.

천정과 바닥 면은 이웃 말고는 볼 것이 없어서, 따로 지정하지 않으면 주변을 그대로 이어
그린다. `event_002`에서는 하늘 자리에 관중이 그려졌다. `--up-prompt`(천정)와
`--down-prompt`(바닥)로 그 두 면만 다른 장면으로 지정한다.

```bash
  --up-prompt "clear dark night sky seen straight up, faint stars, no people, no ground" \
  --up-negative-prompt "people, crowd, hands, faces, ground, stage" \
  --down-prompt "ground level view looking straight down at a dark grass field" \
  --down-negative-prompt "sky, stars, ceiling"
```

`event_003`은 모든 시점에서 생성 주변부 움직임을 100% 유지한다. 4초 이후에 발생했던
채도 상승과 삼각형 경계는 프레임을 고정하는 후처리가 아니라 Argus 배치 조건 초기화로
해결한다. 정면 마스크는 바깥쪽 1.5%를 제외하고 10% 폭의 smoothstep 페더를 사용한다.

## 5. 다중 GPU로 남은 학생 이벤트 동시 생성

GPU가 3개 이상 보이는 한 워크스페이스에서는 다음 실행기로 남은 세 이벤트를 동시에
생성한다. 각 하위 프로세스에는 하나의 물리 GPU만 노출되며, 프로세스 내부에서는 항상
`cuda:0`을 사용한다.

| 이벤트 | 물리 GPU |
| --- | --- |
| `event_002` | GPU 0 |
| `event_001` | GPU 1 |
| `event_004` | GPU 2 |

```bash
python scripts/gpu360/run_parallel_events.py --check-config
nvidia-smi -L
python scripts/gpu360/run_parallel_events.py
```

이벤트별 로그는 `.gpu360/logs/parallel-<UTC 시각>/`에 분리한다. 한 작업이 실패해도
다른 GPU 작업은 중단하지 않으며, 세 작업이 모두 성공한 경우에만 학생 이벤트 에셋을
프런트엔드로 한 번 내보낸다. 중간 단계부터 다시 시작할 때는 모든 대상에 동일한
`--from-stage`를 전달한다.

## 6. 완료 후 검수

자동 검증은 해상도, 2:1 비율, H.264/yuv420p, AAC, FPS와 길이를 확인한다. 다음은
사람이 직접 확인해야 한다.

- 0°/360° seam에서 물체가 끊기거나 깜빡이지 않는가
- 25프레임 내부 배치 경계에서 시간적 점프가 없는가
- 정면 원본과 AI 생성 영역의 페더에 이중상이 없는가
- 고개를 돌렸을 때 상하 극점과 후면이 자연스러운가
- AI로 생성된 주변 시야가 실제 기록으로 오인되지 않게 표시되는가

완성 MP4는 크기를 확인한 뒤 Git LFS 또는 팀의 대용량 에셋 저장소를 사용한다.
체크포인트와 `gpu360/work`은 커밋하지 않는다.

생성과 검증이 끝나면 실행기가 각 `metadata.json`에 `panorama_video`를 추가하고
`availability.panorama_ready`를 켠다. `event_002`, `event_003`, `event_004`는 전환을 마쳤다.
