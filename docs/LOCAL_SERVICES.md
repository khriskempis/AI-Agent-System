# Local Services Reference

Services worth running locally on RTX 4070 Super (12GB VRAM) + 32GB RAM.
All run in Docker. No cloud API costs once set up.

---

## Local LLMs via Ollama

Ollama supports mixed GPU/CPU loading — fills VRAM first, spills to RAM.
Your total addressable memory for model weights: **12GB VRAM + 32GB RAM = ~44GB**.

### Models Already Installed
| Model | Size | Used for |
|---|---|---|
| `llama3.1:8b` | ~5GB | Idea classification, QA evaluation (director.ts) |
| `deepseek-r1:14b` | ~9GB | Project planning with chain-of-thought (plan-idea.ts) |

### Recommended Upgrades
| Model | Size (Q4) | How it runs | Best for |
|---|---|---|---|
| `deepseek-r1:32b` | ~20GB | ~12GB VRAM + ~8GB RAM | Best quality mostly on GPU — general purpose + reasoning |
| `qwen2.5-coder:32b` | ~20GB | ~12GB VRAM + ~8GB RAM | Best local coding model |
| `llama3.3:70b` | ~40GB | ~12GB VRAM + ~28GB RAM | Best general-purpose available; slow but capable |
| `deepseek-r1:70b` | ~40GB | ~12GB VRAM + ~28GB RAM | Best reasoning/thinking; great for overnight batch work |

**Pull a model:**
```bash
docker exec ollama ollama pull deepseek-r1:32b
docker exec ollama ollama pull llama3.3:70b
```

**DeepSeek R1 note:** DeepSeek R1 models use chain-of-thought reasoning — they "think out loud"
before answering. This makes them significantly better at complex reasoning, analysis, and planning
than same-size models. The `<think>` tags in the output are stripped by ollama.ts before returning.

---

## Already Running

### Whisper (port 9000)
GPU-accelerated speech-to-text via faster-whisper. Used by the analyze-tiktok pipeline.
- Model: `medium` (~1.5GB, ~5GB VRAM when active)
- Upgrade to `large-v3` for best accuracy (~10GB VRAM — use when Ollama is stopped)
- Health check: `curl http://localhost:9000/health`

### Ollama (port 11434)
Local LLM inference server.
- Health check: `curl http://localhost:11434/api/tags`

### MySQL (port 3306)
Two databases: `orchestrator` (pipeline audit log) + `tiktok` (video archive)

---

## High Priority Additions

### Qdrant — Vector Database (port 6333)
Semantic search across all your analyzed content. The storage layer for a RAG system.
Lets you query "find content related to X" across 10k+ TikTok transcripts, articles, and Notion pages.

```bash
docker run -d --name qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v qdrant_data:/qdrant/storage \
  --network mcp-servers-network \
  qdrant/qdrant
```

Dashboard: http://localhost:6333/dashboard
RAM usage: ~500MB idle, scales with collection size.

**Embedding model (needed to use Qdrant):**
```bash
# Pull nomic-embed-text via Ollama — fast, small, good quality
docker exec ollama ollama pull nomic-embed-text
```

See `docs/RAG_ARCHITECTURE.md` for how this fits into the full system.

### Open WebUI — Chat Interface for Ollama (port 3000)
ChatGPT-like UI that connects to your local Ollama. Test any model interactively
before wiring it into pipelines. No data leaves your machine.

```bash
docker run -d --name open-webui \
  -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  -v open-webui_data:/app/backend/data \
  --network mcp-servers-network \
  ghcr.io/open-webui/open-webui:main
```

UI: http://localhost:3000 — connect it to `http://ollama:11434` in settings.

---

## Future Additions

### Kokoro TTS — Text-to-Speech
Generate audio narration locally from your written content (blog posts, summaries).
Useful for turning ResearchAgent output back into audio/video content.
- GPU-accelerated, sounds natural
- Docker image: `ghcr.io/remsky/kokoro-fastapi-cpu` (CPU) or GPU variant

### ComfyUI — Stable Diffusion Image Generation
Generate thumbnails, header images, social post visuals locally.
12GB VRAM runs SDXL at full quality.
- Useful once the content pipeline starts producing blog posts and social content
- Docker: `ghcr.io/ai-dock/comfyui`

---

## GPU Memory Planning (RTX 4070 Super — 12GB VRAM)

Services don't run concurrently in the analyze-tiktok pipeline:
Whisper transcribes → releases GPU → Ollama analyzes → releases → next video.

| Service | VRAM when active |
|---|---|
| Whisper medium | ~5GB |
| Whisper large-v3 | ~10GB |
| Ollama + llama3.1:8b | ~5GB |
| Ollama + deepseek-r1:14b | ~9GB |
| Ollama + deepseek-r1:32b | ~12GB (fills VRAM, spills ~8GB to RAM) |
| Ollama + llama3.3:70b | ~12GB VRAM + ~28GB RAM |
| ComfyUI + SDXL | ~8GB |

**Tip:** For overnight batch analysis jobs with `analyze-tiktok --all`, stop Ollama first
to give Whisper the full 12GB, then restart Ollama for the analysis pass.
