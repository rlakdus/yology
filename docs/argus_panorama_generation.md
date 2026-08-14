# event_003 Argus panorama-video handoff

The web application consumes a completed mono equirectangular video at:

`events/student/event_003/panorama/mongolia-horse-360.mp4`

The generated file is intentionally not replaced by a fake local conversion. Until the
external GPU job produces it, `generation.json` remains `pending_external_gpu` and the
VR page displays the static panorama with a retryable video error.

## External GPU job

1. Use a Linux CUDA worker and install the three environments and checkpoints described
   by the official [Argus repository](https://github.com/Red-Fairy/argus-code): camera
   trajectory prediction, 360 video generation, and VEnhancer.
2. Use `videos/horse-riding.mp4` as the source. Run the full-video sampling path at
   1024x512 with 25-frame internal batches. Do not generate independent clips.
3. Enhance the generated panorama to 2048x1024.
4. Using Argus camera calibration and trajectory output, project the original source
   frames back into their recorded forward field of view. Keep the center at full source
   weight and blend only the outer 5% of the projection mask.
5. Make the equirectangular left/right boundary wrap continuously, retain the exact source
   frame rate and duration, and mux the original audio.
6. Encode H.264 High Profile, `yuv420p`, AAC audio, with MP4 `faststart` enabled.

Store the checkpoint identifier and final parameters in `generation.json`, then change
its status to `complete`. Generated surroundings must remain identified as an AI
hypothesis; only the reprojected forward field is recorded evidence.

## Acceptance checks

Run this on the GPU worker, where `ffprobe` is installed:

```bash
python scripts/validate_panorama_video.py \
  events/student/event_003/panorama/mongolia-horse-360.mp4 \
  --source events/student/event_003/videos/horse-riding.mp4
```

Then visually inspect the 0°/360° seam, temporal batch boundaries, and the feather around
the recorded forward view. The validator covers projection dimensions, browser codecs,
duration, frame rate, and audio presence; those visual consistency checks still require
review of the generated frames.
