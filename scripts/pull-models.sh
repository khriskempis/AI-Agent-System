#!/bin/bash
# Wait for Ollama to be ready, then pull all required models.
# Usage: ./scripts/pull-models.sh
# Safe to re-run — Ollama skips models already downloaded.

set -e

OLLAMA_CONTAINER="ollama"
MODELS=("llama3.1:8b" "deepseek-r1:14b")

echo "Waiting for Ollama container to start..."
until docker ps --filter "name=^/${OLLAMA_CONTAINER}$" --filter "status=running" --format "{{.Names}}" | grep -q "^${OLLAMA_CONTAINER}$"; do
  sleep 3
done
echo "Container is running."

echo "Waiting for Ollama HTTP API to be ready..."
until docker exec "${OLLAMA_CONTAINER}" ollama list >/dev/null 2>&1; do
  sleep 3
done
echo "Ollama is ready."

for MODEL in "${MODELS[@]}"; do
  echo ""
  echo "Pulling ${MODEL}..."
  docker exec "${OLLAMA_CONTAINER}" ollama pull "${MODEL}"
  echo "${MODEL} done."
done

echo ""
echo "All models pulled. Installed models:"
docker exec "${OLLAMA_CONTAINER}" ollama list
