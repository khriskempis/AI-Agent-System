# System Architecture

The single authoritative reference for how this system is designed.
Read this before making changes to any component.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  HOST MACHINE  (RTX 4070 Super · 32GB RAM · WSL2 Ubuntu)        │
│                                                                  │
│  ┌───────────────────┐  ┌───────────────────┐                  │
│  │ notion-idea-server│  │   orchestrator    │                  │
│  │ :3001             │  │   TypeScript CLI  │                  │
│  │ REST API → Notion │  │   pipelines +     │                  │
│  └─────────┬─────────┘  │   scheduler       │                  │
│            │            └─────────┬─────────┘                  │
│            └──── mcp-servers-network ───┘                       │
│                          │                                       │
│  ┌───────────────────────┴──────────────────────────────────┐   │
│  │  orchestrator-mysql  :3306                               │   │
│  │  DB: orchestrator  →  pipeline audit log                 │   │
│  │  DB: tiktok        →  video archive + analysis           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ ollama       │  │ whisper      │  │ qdrant       │         │
│  │ :11434       │  │ :9000        │  │ :6333        │         │
│  │ local LLMs   │  │ audio →text  │  │ vector DB    │         │
│  │ GPU ✓        │  │ GPU ✓        │  │ semantic     │         │
│  └──────────────┘  └──────────────┘  │ search       │         │
│                                       └──────────────┘         │
│  ┌──────────────┐                                               │
│  │ portainer    │  Docker management UI  http://localhost:9001  │
│  │ :9001        │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Intelligence — LLM Routing

Three AI systems with distinct roles. The rule: **local models for fast/cheap work, Claude for deep reasoning.**

| Model | Where | Used for | Cost |
|---|---|---|---|
| `llama3.1:8b` | Ollama (GPU) | Idea classification, QA evaluation | Free |
| `deepseek-r1:14b` | Ollama (GPU) | Project planning, chain-of-thought | Free |
| `claude-sonnet-4-6` | Anthropic API | Deep research, analysis, content repurposing | Per token |
| `mxbai-embed-large` | Ollama (GPU) | Text → 1024-dim vectors for Qdrant | Free |
| `whisper medium` | whisper container (GPU) | MP4 audio → transcript text | Free |

---

## The Three-Layer Rule

All code follows this rule — **layers only call downward, never upward.**

```
Layer 3 — index.ts / scheduler.ts
  Decides WHAT runs and WHEN.
  CLI entry point or cron timer. Composes pipelines.
  Never calls databases or APIs directly.
        │
        ▼
Layer 2 — Pipelines + LLM Agents
  HOW a specific task gets done. Ordered stage sequences.
  Calls Layer 1 for data. Calls LLM models directly.
  Logs every stage to MySQL.
        │
        ▼
Layer 1 — Client modules  (NO LLM calls)
  Raw data access only.
  notion-client.ts, tiktok-client.ts, qdrant-client.ts
  Typed functions over HTTP APIs and databases.
  Never calls pipelines. Never calls LLMs.
```

**The core rule:** Pipelines use clients. Clients don't run pipelines.

---

## The 5 Pipelines

### 1. categorize-idea

Routes Notion ideas from the inbox to the correct destination database.

```
Trigger: node-cron 09:00 ET (daily) or manual:
  npx tsx src/index.ts categorize-idea --id <id>
  npx tsx src/index.ts categorize-idea --all

FETCH → PARSE → CLASSIFY → VALIDATE → EVALUATE → WRITE
                    ↑______________|
                    QA retry loop (max 2)

FETCH     NotionAgent.getIdea() — loads Notion idea page
PARSE     Extract content blocks from the page
CLASSIFY  llama3.1:8b — assigns destination + tags
            destinations: projects | knowledge | journal
VALIDATE  llama3.1:8b — scores the classification 0-10
EVALUATE  llama3.1:8b — accepts if score ≥ 8, retries if not
            if retries exhausted → status set to "Needs Review" in Notion
WRITE     NotionAgent.updateIdea() — creates page in destination DB
            source idea status set to "Done"
```

Audit: every stage logged to `orchestrator.workflow_runs` + `workflow_events`.
Idempotent: `isRunning()` guard prevents duplicate concurrent runs.

---

### 2. plan-idea

Generates a full implementation plan for an approved project.

```
Trigger: manual — set Notion project status to "Ready for Planning", then:
  npx tsx src/index.ts plan-idea --id <id>
  npx tsx src/index.ts plan-idea --all

FETCH → PLAN → WRITE

FETCH   NotionAgent.getProjectPage() — load project page + content
PLAN    deepseek-r1:14b — generates full agent-executable plan:
          Objective, Tech Stack, Phases, Human Checkpoints, Open Questions
        Re-run detection: if page starts with "# Plan" → revision mode,
          incorporates any feedback written below the existing plan
WRITE   NotionAgent writes plan back to Notion
          sets project status → "Pending Review"
```

---

### 3. analyze-tiktok

Transcribes local TikTok MP4 files and runs deep content analysis.

```
Trigger: manual:
  npx tsx src/index.ts analyze-tiktok --id <video_id>
  npx tsx src/index.ts analyze-tiktok --limit 50
  npx tsx src/index.ts analyze-tiktok --all

FETCH → TRANSCRIBE → ANALYZE → WRITE

FETCH       tiktok-client.getPendingVideos()
              WHERE has_local_file=1 AND analysis_status='pending'
              ordered by: bookmarked first, then digg_count DESC
TRANSCRIBE  HTTP POST → whisper :9000
              faster-whisper medium model, CUDA
              returns: { transcript, language, duration_seconds }
              path translation: /mnt/m/TT videos/data → /tiktok-videos (container mount)
ANALYZE     research-agent.ts (Layer 2):
              1. Embeds content preview → queries Qdrant for similar existing items
              2. If similarity > 0.75 → injects prior knowledge into Claude context
              3. claude-sonnet-4-6 → returns:
                   summary, keyInsights[], contentOpportunities[],
                   suggestedContentType, suggestedNextSteps[], confidence
WRITE       tiktok-client.saveAnalysis()
              inserts to tiktok.tiktok_analysis
              analysis_status → 'done'
```

Source: 10,075 local MP4s at `/mnt/m/TT videos/data/Favorites/videos/` and `Likes/videos/`

---

### 4. embed-tiktok

Indexes analyzed videos as vectors in Qdrant for semantic search.

```
Trigger: manual — run after analyze-tiktok:
  npx tsx src/index.ts embed-tiktok
  npx tsx src/index.ts embed-tiktok --limit 200
  npx tsx src/index.ts embed-tiktok --reindex   # force re-embed all

FETCH → EMBED → UPSERT

FETCH   MySQL: tiktok_analysis WHERE status='done'
          skips already-indexed videos (isIndexed() check) unless --reindex
EMBED   mxbai-embed-large via Ollama
          input: caption + " | " + summary + " | " + keyInsights joined
          output: 1024-dimension float vector
UPSERT  qdrant-client.upsertBatch() — 100 vectors per HTTP call
          payload stored: source_type, source_id, title, summary,
                          content_type, source_url, embedded_at

Idempotent — stable point IDs derived from source_id, overwrites on re-run
```

---

### 5. scheduler

Keeps the daily automation running.

```
Trigger: process stays running (orchestrator Docker service or manual):
  npx tsx src/index.ts scheduler

node-cron: "0 9 * * *" America/New_York
  └─ runDailyProcessing()
       └─ categorizeIdea() for every "Not Started" idea in Notion
```

---

## The Knowledge Base — RAG Flow

The ResearchAgent (called by analyze-tiktok and future pipelines) uses Retrieval-Augmented Generation to make every analysis aware of what you already know.

```
New content arrives (transcript, article, note)
        │
        ▼
1. Embed a preview → mxbai-embed-large → 1024-dim vector
        │
        ▼
2. Query Qdrant → top 4 most similar items (cosine similarity)
        │
        ├─ score > 0.75? → inject summaries into Claude's system prompt
        │                    "You already know these related items: ..."
        └─ score ≤ 0.75? → analyze without prior context
        │
        ▼
3. Claude Sonnet reasons over NEW content + PRIOR KNOWLEDGE
        │
        ▼
4. Returns: summary, insights, content opportunities, next steps
        │
        ▼
5. Result saved to MySQL + embedded to Qdrant → grows the knowledge base
```

The index compounds: more content analyzed → richer retrieval → better analysis.

---

## The Three Databases

```
MySQL  (orchestrator-mysql container, port 3306)

  orchestrator  — portable, safe to sync across machines
  ├── workflow_runs    one row per pipeline execution
  │     id (UUID), pipeline, notion_page_id, status, current_stage,
  │     attempts, stage_results (JSON), started_at, completed_at
  └── workflow_events  immutable audit log, one row per stage
        run_id (FK), stage, status, attempt, result (JSON),
        error_message, duration_ms, created_at

  tiktok  — local only, stays on this machine
  ├── tiktok_authors   7,255 TikTok creator profiles
  │     author_id (PK), unique_id (@handle), nickname,
  │     follower_count, heart_count, video_count
  ├── tiktok_videos    10,159 video records
  │     video_id (PK), author_id (FK), caption, create_time,
  │     digg_count, play_count, tiktok_url,
  │     is_liked, is_bookmarked, has_local_file, local_file_path
  └── tiktok_analysis  analysis results per video
        video_id (FK), transcript (JSON blob), summary,
        content_type (blog|social|reference), analysis_status (pending|done)

Qdrant  (qdrant container, port 6333)
  collection: knowledge  — source-agnostic, all content types
    vector: 1024 floats (mxbai-embed-large)
    payload: source_type, source_id, title, summary,
             content_type, source_url, embedded_at
  Dashboard: http://localhost:6333/dashboard
```

---

## Agents Reference

| Agent | Layer | LLM | Role |
|---|---|---|---|
| `director.ts` | 2 | llama3.1:8b | classifyIdeas(), evaluateQA() — routing + scoring |
| `validator.ts` | 2 | llama3.1:8b | validateClassification() — score 0-10 with feedback |
| `research-agent.ts` | 2 | claude-sonnet-4-6 | General-purpose deep research, URL resolution, RAG |
| `notion-agent.ts` | 1 | none | Notion HTTP facade — all Notion reads/writes |
| `planner-agent.ts` | 2 | deepseek-r1:14b | Delegates to run-planning.ts |
| `validation-agent.ts` | 2 | none | QA assessment of categorization runs |

---

## Client Modules (Layer 1)

| Module | Database/Service | Key functions |
|---|---|---|
| `notion-client.ts` | notion-idea-server :3001 | getIdea, getAllUnprocessedIdeas, updateIdea |
| `tiktok-client.ts` | MySQL tiktok DB | getPendingVideos, getVideoById, getTranscriptForVideo, saveAnalysis, recordFailure |
| `qdrant-client.ts` | Qdrant :6333 | ensureCollection, upsertPoint, upsertBatch, search, isIndexed, collectionStats |

---

## Model Wrappers (src/models/)

| Module | Service | Functions |
|---|---|---|
| `claude.ts` | Anthropic API | ask(), askJSON() — configurable max_tokens |
| `ollama.ts` | Ollama :11434 | ask(), askJSON() — llama3.1:8b, deepseek-r1:14b |
| `embeddings.ts` | Ollama :11434 | embed() → number[], buildEmbedText() |

---

## File Map

```
orchestrator/
├── src/
│   ├── index.ts                     CLI: categorize-idea | plan-idea |
│   │                                     analyze-tiktok | embed-tiktok | scheduler
│   ├── scheduler.ts                 Layer 3: node-cron + runDailyWorkflow
│   ├── workflow.ts                  withRetry utility (exponential backoff)
│   ├── logger.ts                    Structured logger (FETCH/PARSE/CLASSIFY/...)
│   ├── notion-client.ts             NotionIdea + UpdateIdeaPayload types + HTTP calls
│   ├── tiktok-client.ts             Layer 1: tiktok MySQL read/write
│   ├── qdrant-client.ts             Layer 1: Qdrant vector DB read/write
│   ├── agents/
│   │   ├── types.ts                 AgentInput, AgentOutput, AgentContext interfaces
│   │   ├── director.ts              classifyIdeas + evaluateQA (Ollama)
│   │   ├── validator.ts             validateClassification (Ollama)
│   │   ├── research-agent.ts        Deep research + RAG (Claude Sonnet)
│   │   ├── notion-agent.ts          Layer 1: Notion HTTP facade
│   │   ├── planner-agent.ts         Layer 2: delegates to run-planning.ts
│   │   └── validation-agent.ts      Layer 2: QA assessment
│   ├── db/
│   │   ├── schema.sql               orchestrator DB DDL
│   │   ├── connection.ts            MySQL2 pool (no-ops if MYSQL_HOST unset)
│   │   └── workflow-store.ts        createRun, logEvent, completeRun
│   ├── models/
│   │   ├── claude.ts                Claude API wrapper
│   │   ├── ollama.ts                Ollama API wrapper
│   │   └── embeddings.ts            Ollama embeddings wrapper
│   └── pipelines/
│       ├── categorize-idea.ts       FETCH→PARSE→CLASSIFY→VALIDATE→EVALUATE→WRITE
│       ├── daily-processing.ts      Loops categorizeIdea over all unprocessed
│       ├── plan-idea.ts             FETCH→PLAN→WRITE for a single project
│       ├── run-planning.ts          Loops planIdea over all ready projects
│       ├── analyze-tiktok.ts        FETCH→TRANSCRIBE→ANALYZE→WRITE
│       └── embed-tiktok.ts          FETCH→EMBED→UPSERT to Qdrant
├── scripts/tiktok/
│   └── import.ts                   One-time TikTok archive import (run from orchestrator/)
scripts/
├── tiktok/
│   └── schema.sql                  tiktok DB DDL (auto-loaded by MySQL on first start)
├── pull-models.sh                  Download all Ollama models
├── start.sh                        Start stack + wait for MySQL health
└── stop.sh                         Stop all containers
whisper-service/
├── app.py                          FastAPI transcription service
├── Dockerfile                      nvidia/cuda base + Python + faster-whisper
└── requirements.txt
```

---

## How to Extend

- **New Notion capability** → add method to `notion-agent.ts` (Layer 1)
- **New pipeline** → new file in `src/pipelines/`, register command in `index.ts`
- **New LLM agent** → new file in `src/agents/`, call from a pipeline (Layer 2)
- **New content source** → new client module (Layer 1), new pipeline (Layer 2)
- **New Docker service** → add to `docker-compose.yml`, add volume if persistent

---

## Key Design Decisions

**Why MySQL + Qdrant instead of one database?**
MySQL handles structured relational data (pipeline audit logs, video metadata, foreign keys). Qdrant handles vector similarity search — finding semantically similar content regardless of exact wording. They're complementary tools for fundamentally different query patterns.

**Why local LLMs for classification but Claude for research?**
Classification is fast, structured, and repetitive — llama3.1:8b handles it at zero cost per call. Research requires synthesis, nuanced reasoning, and handling of long context — that's where Claude's capabilities justify the API cost.

**Why one Qdrant collection for all content types?**
A single `knowledge` collection with a `source_type` payload field means any future content (articles, Notion pages, notes) is immediately searchable alongside TikTok transcripts. Splitting by type would require querying multiple collections for cross-source retrieval.

**Why are the tiktok and orchestrator databases separate?**
The orchestrator DB is small (~KB per run) and safe to back up or sync to another machine. The tiktok DB is massive (10k+ videos) and machine-local. Keeping them separate means you can move the orchestrator DB without carrying the video archive.

**Why is `withRetry` applied at two levels in categorize-idea?**
Stage-level retries handle transient API failures (rate limits, timeouts) without restarting the pipeline. The QA loop retries the classify→validate sequence when the output quality is too low. These are independent concerns — a network hiccup retries the HTTP call, not the entire classification.
