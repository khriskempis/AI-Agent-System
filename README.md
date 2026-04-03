# AI Agent System

A personal knowledge hub and content pipeline built on local LLMs, Docker, and Claude.
Ingests TikTok videos, Notion ideas, and web content — transcribes, analyzes, and
indexes everything into a searchable knowledge base.

**Cost advantage:** Transcription, classification, embeddings, and planning all run
locally on GPU. Claude is only called for deep research — minimizing API spend.

---

## What It Does

```
TikTok MP4s ──→ Whisper ──→ transcript
Notion ideas ──→ pipeline ──→ routed to projects/knowledge/journal
Web articles ──→ fetch ──→ analyzed
         │
         ▼
ResearchAgent (Claude Sonnet)
  queries your existing knowledge base first,
  then synthesizes new insights on top of what you already know
         │
         ▼
MySQL (structured metadata + audit log)
Qdrant (semantic vector index — find anything by meaning, not keywords)
```

---

## Stack

| Service | Port | Role |
|---|---|---|
| `orchestrator` | — | TypeScript CLI — all pipelines run here |
| `notion-idea-server` | 3001 | REST API over Notion |
| `orchestrator-mysql` | 3306 | Pipeline audit log + TikTok archive |
| `ollama` | 11434 | Local LLMs (llama3.1:8b, deepseek-r1:14b, mxbai-embed-large) |
| `whisper` | 9000 | GPU audio transcription (faster-whisper) |
| `qdrant` | 6333 | Vector database for semantic search |
| `portainer` | 9001 | Docker management UI |

---

## Pipelines

| Command | What it does |
|---|---|
| `categorize-idea --all` | Classify Notion inbox → route to projects/knowledge/journal |
| `plan-idea --all` | Generate implementation plans for approved projects |
| `analyze-tiktok --limit N` | Transcribe MP4s + deep analysis via Claude |
| `embed-tiktok` | Index analyzed content into Qdrant for semantic search |
| `scheduler` | Run categorize-idea daily at 09:00 ET |

---

## Documentation

| Doc | What's in it |
|---|---|
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Full setup from scratch — Docker, models, env, first run |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Complete system architecture — all pipelines, agents, databases, design decisions |
| [docs/LOCAL_SERVICES.md](./docs/LOCAL_SERVICES.md) | Local LLM models, recommended upgrades, GPU memory guide |

---

## Quick Start

**Full setup guide:** [GETTING_STARTED.md](./GETTING_STARTED.md)

```bash
# 1. Clone and create Docker network
git clone https://github.com/khriskempis/AI-Agent-System.git
cd AI-Agent-System
docker network create mcp-servers-network

# 2. Configure environment
cp orchestrator/env.template orchestrator/.env
# Fill in ANTHROPIC_API_KEY and Notion database IDs

# 3. Install Node deps
cd orchestrator && npm install && cd ..

# 4. Start services
./scripts/start.sh

# 5. Pull Ollama models (one-time, ~14GB)
./scripts/pull-models.sh

# 6. Import TikTok archive (if applicable)
cd orchestrator && npx tsx scripts/tiktok/import.ts

# 7. Run a pipeline
npx tsx src/index.ts categorize-idea --all
npx tsx src/index.ts analyze-tiktok --limit 50
npx tsx src/index.ts embed-tiktok
```

---

## Monitoring

| Tool | URL |
|---|---|
| Portainer (Docker) | http://localhost:9001 |
| Qdrant Dashboard | http://localhost:6333/dashboard |
| DBeaver → MySQL | localhost:3306, root / rootpassword |
