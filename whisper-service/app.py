"""
Whisper Transcription Service

A minimal FastAPI wrapper around faster-whisper.
Receives a file path (inside the container), returns transcript text.

Endpoints:
  POST /transcribe  { "file_path": "/tiktok-videos/Favorites/videos/xxx.mp4" }
  GET  /health      → { "status": "ok", "model": "medium" }
"""

import os
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("whisper-service")

# Model size is configurable via env var — default to "medium" for quality/speed balance.
# Options: tiny, base, small, medium, large-v3
# With RTX 4070 Super (12GB VRAM): medium uses ~5GB, large-v3 uses ~10GB.
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "medium")
DEVICE = os.environ.get("WHISPER_DEVICE", "cuda")  # fall back to "cpu" if no GPU
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "float16")  # float16 for GPU, int8 for CPU

log.info(f"Loading Whisper model: {MODEL_SIZE} on {DEVICE} ({COMPUTE_TYPE})")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
log.info("Model loaded and ready")

app = FastAPI(title="whisper-service")


class TranscribeRequest(BaseModel):
    file_path: str
    language: str | None = None  # force language detection if None, or pass e.g. "en"


class TranscribeResponse(BaseModel):
    transcript: str
    language: str
    duration_seconds: float


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE}


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(req: TranscribeRequest):
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

    log.info(f"Transcribing: {req.file_path}")

    segments, info = model.transcribe(
        req.file_path,
        language=req.language,
        beam_size=5,
        vad_filter=True,          # skip silent sections — faster and cleaner output
        vad_parameters={"min_silence_duration_ms": 500},
    )

    # Segments are a generator — consume them to build the full transcript
    transcript_parts = [segment.text.strip() for segment in segments]
    transcript = " ".join(transcript_parts)

    log.info(f"Done — {info.duration:.1f}s of {info.language} audio, {len(transcript)} chars")

    return TranscribeResponse(
        transcript=transcript,
        language=info.language,
        duration_seconds=round(info.duration, 1),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
