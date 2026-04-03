# Whisper Transcription Service
# Base: nvidia/cuda with Python — gives us CUDA drivers + Python in one image.
# faster-whisper uses CTranslate2 under the hood, which supports CUDA natively.

FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# Avoid interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY app.py .

# Model is downloaded at container startup (first run only).
# Subsequent starts use the cached model from the whisper_models volume.
ENV WHISPER_MODEL=medium
ENV WHISPER_DEVICE=cuda
ENV WHISPER_COMPUTE_TYPE=float16

# Cache downloaded model files to a volume so they persist across rebuilds
ENV HF_HOME=/models
ENV XDG_CACHE_HOME=/models

EXPOSE 9000

CMD ["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000"]
