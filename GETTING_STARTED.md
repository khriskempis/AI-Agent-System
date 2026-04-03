# Getting Started — AI Agent System

A complete guide to setting up and running the full stack from scratch on WSL2 Ubuntu.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Windows 11 + WSL2 Ubuntu | All commands run in the Ubuntu terminal |
| Docker Desktop for Windows | Enable WSL2 integration in Settings → Resources → WSL Integration |
| NVIDIA GPU + drivers | RTX 4070 Super or equivalent — required for Ollama and Whisper |
| NVIDIA Container Toolkit | Needed for GPU passthrough into Docker containers |
| Node.js 20+ | Install via `nvm` inside WSL2 |
| Anthropic API key | Used by the orchestrator for Claude Sonnet calls |
| Notion API key + database IDs | For the idea categorization and planning pipelines |

### Verify GPU is accessible in Docker

Before starting, confirm Docker can see your GPU:

```bash
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

You should see your GPU listed. If not, install the NVIDIA Container Toolkit:

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

---

## Architecture Overview

```
orchestrator (TypeScript CLI)
  ├── categorize-idea     → classifies Notion ideas → routes to projects/knowledge/journal
  ├── plan-idea           → generates agent-executable plans for approved projects
  ├── analyze-tiktok      → transcribes local TikTok MP4s → deep analysis via Claude
  ├── embed-tiktok        → indexes analyzed content into Qdrant for semantic search
  └── scheduler           → runs categorize-idea daily at 09:00 ET

notion-idea-server (port 3001)
  └── REST API over Notion — the only service that talks to Notion directly

mysql (port 3306)
  ├── orchestrator DB     → pipeline audit log (workflow_runs, workflow_events)
  └── tiktok DB           → TikTok archive (tiktok_videos, tiktok_authors, tiktok_analysis)

ollama (port 11434)
  ├── llama3.1:8b         → fast classification (director.ts)
  ├── deepseek-r1:14b     → deep planning (plan-idea.ts)
  └── mxbai-embed-large   → text → 1024-dim vectors for Qdrant

whisper (port 9000)
  └── faster-whisper medium → audio transcription for TikTok MP4s

qdrant (port 6333)
  └── vector database → semantic search across all analyzed content
      dashboard: http://localhost:6333/dashboard

portainer (port 9001)
  └── Docker management UI → container logs, stats, health
      http://localhost:9001
```

**LLM split by workload:**
- **Local (Ollama)** — fast, cheap, runs on GPU: classification, QA evaluation, planning, embeddings
- **Claude Sonnet** — comprehensive reasoning: research, analysis, content repurposing

Full architecture reference: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Step 1 — Clone and Create the Docker Network

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/khriskempis/AI-Agent-System.git
cd AI-Agent-System

# Create the shared Docker network (only needed once — survives restarts)
docker network create mcp-servers-network
```

---

## Step 2 — Configure Environment

```bash
cp orchestrator/env.template orchestrator/.env
```

Open `orchestrator/.env` and fill in:

```env
ANTHROPIC_API_KEY=sk-ant-...          # your Anthropic key

NOTION_API_URL=http://localhost:3001  # leave as-is when running locally

# Notion database IDs — get these from your Notion workspace URLs
NOTION_PROJECTS_DATABASE_ID=...
NOTION_KNOWLEDGE_DATABASE_ID=...
NOTION_JOURNAL_DATABASE_ID=...

# Ollama — use container name when running via Docker
OLLAMA_URL=http://ollama:11434

# Whisper — use container name when running via Docker
WHISPER_URL=http://whisper:9000

# TikTok video archive path on this machine (WSL path to Windows drive)
TIKTOK_VIDEOS_PATH=/mnt/m/TT videos/data

# MySQL — leave these as-is (matches docker-compose defaults)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=orchestrator
MYSQL_PASSWORD=orchestrator
MYSQL_DATABASE=orchestrator
```

Also configure the Notion server:

```bash
cp notion-idea-server/env.template notion-idea-server/.env 2>/dev/null || true
# Add your NOTION_API_KEY to notion-idea-server/.env
```

---

## Step 3 — Install Node Dependencies

```bash
cd ~/projects/AI-Agent-System/orchestrator
npm install
```

---

## Step 4 — Start the Docker Stack

```bash
cd ~/projects/AI-Agent-System

# Start everything (MySQL + Ollama + Whisper + Notion server + Orchestrator)
docker-compose up -d

# Or start just the services you need:
docker-compose up -d mysql ollama whisper notion-idea-server-http
```

Check that everything came up:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
NAMES                        STATUS          PORTS
mcp-notion-idea-server-http  Up X seconds    0.0.0.0:3001->3001/tcp
orchestrator                 Up X seconds
orchestrator-mysql           Up X seconds (healthy)   0.0.0.0:3306->3306/tcp
ollama                       Up X seconds    0.0.0.0:11434->11434/tcp
whisper                      Up X seconds    0.0.0.0:9000->9000/tcp
```

**Note:** On first startup, MySQL auto-creates two databases from the init SQL files:
- `orchestrator` — pipeline audit log
- `tiktok` — TikTok archive (empty until you run the import)

---

## Step 5 — Download Ollama Models

Ollama needs two models pulled before the pipelines will work. Run the pull script in a separate terminal window — the downloads are large (~14GB total) and take a while:

```bash
cd ~/projects/AI-Agent-System
./scripts/pull-models.sh
```

This script waits for the Ollama container to be healthy, then pulls in sequence:

| Model | Size | Used for |
|---|---|---|
| `llama3.1:8b` | ~4.7 GB | Idea classification + QA evaluation (director.ts) |
| `deepseek-r1:14b` | ~9 GB | Project planning with chain-of-thought (plan-idea.ts) |

To check what's installed at any time:

```bash
docker exec ollama ollama list
```

---

## Step 6 — Whisper Model (auto-downloads on first use)

The Whisper `medium` model (~1.5 GB) downloads automatically the first time the whisper container starts. It's cached in the `whisper_models` Docker volume — subsequent restarts are instant.

You can verify the service is ready:

```bash
curl http://localhost:9000/health
# → {"status":"ok","model":"medium","device":"cuda"}
```

**Model options** (configurable via `WHISPER_MODEL` env in docker-compose):

| Model | VRAM | Speed on RTX 4070S | Accuracy |
|---|---|---|---|
| `base` | ~1 GB | ~5s/video | Decent |
| `small` | ~2 GB | ~8s/video | Good |
| `medium` | ~5 GB | ~15s/video | **Recommended** |
| `large-v3` | ~10 GB | ~25s/video | Best (use when Ollama is stopped) |

To change the model, edit `docker-compose.yml` under the `whisper` service:
```yaml
environment:
  - WHISPER_MODEL=large-v3
```
Then `docker-compose up -d whisper` to rebuild.

---

## Step 7 — Import TikTok Archive (first time only)

If you have the myfavett plugin data, import it into the `tiktok` database:

```bash
cd ~/projects/AI-Agent-System/orchestrator

# Dry run first — no DB writes, just prints stats
npx tsx scripts/tiktok/import.ts --dry-run

# Live import
npx tsx scripts/tiktok/import.ts
```

Expected output:
```
10,159 videos
7,255 authors
516 liked
8,401 bookmarked
10,075 unique local files
```

The import is safe to re-run — it uses `ON DUPLICATE KEY UPDATE` so no duplicates are created.

**Source data location:** `/mnt/m/TT videos/data/.appdata/`
**Local MP4s:** `/mnt/m/TT videos/data/Favorites/videos/` and `Likes/videos/`

---

## Running the Pipelines

### Categorize Ideas (daily pipeline)

Fetches Notion ideas with status "Not Started", classifies them via Ollama, routes to projects/knowledge/journal databases.

```bash
cd ~/projects/AI-Agent-System/orchestrator

# Single idea by Notion page ID
npx tsx src/index.ts categorize-idea --id <notion-page-id>

# All unprocessed ideas
npx tsx src/index.ts categorize-idea --all

# Dry run (no writes to Notion)
npx tsx src/index.ts categorize-idea --id <id> --dry-run
```

### Plan a Project

Generates an agent-executable implementation plan for a Notion project. Set the project status to "Ready for Planning" in Notion first, then:

```bash
# Single project
npx tsx src/index.ts plan-idea --id <notion-page-id>

# All "Ready for Planning" projects
npx tsx src/index.ts plan-idea --all

# Dry run
npx tsx src/index.ts plan-idea --id <id> --dry-run
```

### Analyze TikTok Videos

Transcribes local MP4s via Whisper, then runs deep analysis via Claude Sonnet. Results saved to `tiktok_analysis`.

```bash
# Single video by TikTok video ID
npx tsx src/index.ts analyze-tiktok --id 7459779252146228497

# Batch of 50 (bookmarked + most-liked first)
npx tsx src/index.ts analyze-tiktok --limit 50

# Full batch — all 10,075 local videos (runs for hours)
npx tsx src/index.ts analyze-tiktok --all
```

### Start the Daily Scheduler

Runs `categorize-idea --all` every day at 09:00 ET. Keep this process running in the background or as part of the Docker orchestrator container:

```bash
npx tsx src/index.ts scheduler
```

---

## Connecting to the Databases

### DBeaver (recommended GUI)

Connect to the MySQL container directly from DBeaver on Windows:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `3306` |
| Username | `root` |
| Password | `rootpassword` |

Leave Database blank to see both `orchestrator` and `tiktok` in the left panel.

### CLI

```bash
# Orchestrator audit log
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator

# TikTok database
docker exec -it orchestrator-mysql mysql -u root -prootpassword tiktok
```

### Useful queries

```sql
-- Pipeline run history
SELECT notion_page_name, pipeline, status, started_at, completed_at
FROM orchestrator.workflow_runs
ORDER BY started_at DESC LIMIT 20;

-- TikTok analysis progress
SELECT analysis_status, COUNT(*) AS count
FROM tiktok.tiktok_analysis
GROUP BY analysis_status;

-- Videos with analysis done
SELECT v.video_id, v.caption, a.summary, a.content_type
FROM tiktok.tiktok_videos v
JOIN tiktok.tiktok_analysis a ON a.video_id = v.video_id
WHERE a.analysis_status = 'done'
LIMIT 20;

-- Recent pipeline failures
SELECT r.notion_page_name, e.stage, e.error_message
FROM orchestrator.workflow_events e
JOIN orchestrator.workflow_runs r ON r.id = e.run_id
WHERE e.status = 'FAILED'
ORDER BY e.created_at DESC LIMIT 10;
```

---

## Starting and Stopping

```bash
# Start full stack
cd ~/projects/AI-Agent-System && ./scripts/start.sh

# Stop all containers (data persists in Docker volumes)
./scripts/stop.sh

# Follow live logs
docker-compose logs -f

# Logs for a specific service
docker-compose logs -f whisper
docker-compose logs -f ollama
```

---

## GPU Memory Notes (RTX 4070 Super — 12GB VRAM)

The three GPU services share your VRAM. They don't all run concurrently unless you're doing something unusual, but keep this in mind:

| Service | VRAM when active |
|---|---|
| Ollama + llama3.1:8b | ~5 GB |
| Ollama + deepseek-r1:14b | ~9 GB |
| Whisper medium | ~5 GB |
| Whisper large-v3 | ~10 GB |

For `analyze-tiktok` batches, Whisper and Ollama are NOT running simultaneously (Whisper transcribes → releases → Ollama analyzes), so there's no contention. Claude Sonnet runs over the API — no local VRAM used.

---

## File Reference

```
AI-Agent-System/
├── docker-compose.yml                    # All services + volumes + GPU config
├── scripts/
│   ├── start.sh                          # Start stack + wait for MySQL health
│   ├── stop.sh                           # Stop all containers
│   ├── pull-models.sh                    # Download Ollama models
│   └── tiktok/
│       └── schema.sql                    # tiktok DB schema (auto-loaded by MySQL)
├── whisper-service/
│   ├── app.py                            # FastAPI transcription service
│   ├── Dockerfile                        # CUDA + Python + faster-whisper
│   └── requirements.txt
├── notion-idea-server/                   # REST API over Notion (port 3001)
└── orchestrator/
    ├── env.template                      # Copy to .env and fill in
    ├── scripts/tiktok/
    │   └── import.ts                     # One-time TikTok archive import
    └── src/
        ├── index.ts                      # CLI entry point
        ├── tiktok-client.ts              # TikTok DB read/write layer
        ├── notion-client.ts              # Notion API client
        ├── models/
        │   ├── claude.ts                 # Claude API (Sonnet/Haiku/Opus)
        │   └── ollama.ts                 # Ollama API (local LLMs)
        ├── agents/
        │   ├── director.ts               # classifyIdeas + evaluateQA (Ollama)
        │   ├── research-agent.ts         # Deep research + analysis (Claude Sonnet)
        │   ├── notion-agent.ts           # Notion CRUD operations
        │   └── validation-agent.ts       # Classification QA
        ├── pipelines/
        │   ├── categorize-idea.ts        # FETCH→PARSE→CLASSIFY→VALIDATE→EVALUATE→WRITE
        │   ├── plan-idea.ts              # FETCH→PLAN→WRITE
        │   ├── analyze-tiktok.ts         # FETCH→TRANSCRIBE→ANALYZE→WRITE
        │   └── daily-processing.ts       # Loops categorize-idea over all unprocessed
        └── db/
            ├── connection.ts             # MySQL pool (orchestrator DB)
            ├── schema.sql                # orchestrator DB schema
            └── workflow-store.ts         # createRun, logEvent, completeRun
```

---

## Troubleshooting

**MySQL won't start**
```bash
docker-compose logs mysql
# If volume is corrupt: docker volume rm ai-agent-system_mysql_data
# Warning: this wipes all data — re-run the TikTok import after
```

**Whisper returns 404 for a file**
The container mounts `/mnt/m/TT videos/data` as `/tiktok-videos`. If a path in the DB uses a different base, update `TIKTOK_VIDEOS_PATH` in your `.env` and `docker-compose.yml`.

**Ollama model not found**
```bash
./scripts/pull-models.sh
# Or manually:
docker exec ollama ollama pull llama3.1:8b
docker exec ollama ollama pull deepseek-r1:14b
```

**`Cannot find module` when running tsx**
Always run from the `orchestrator/` directory so Node resolves `node_modules` correctly:
```bash
cd ~/projects/AI-Agent-System/orchestrator
npx tsx src/index.ts <command>
```

**Docker network missing**
```bash
docker network create mcp-servers-network
```
