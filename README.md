# MCP Server - Intelligent Idea Processing System

An intelligent system for processing and managing ideas using Notion and n8n workflows with AI agents.

## 📚 Documentation

**👉 [Complete Documentation](./docs/README.md)** - Start here for setup, troubleshooting, and development guides.

## 🏗️ Project Structure

```
MCP Server/
├── docs/                        # 📚 Organized documentation
│   ├── setup/                   # Setup and configuration guides
│   ├── troubleshooting/         # Error fixes and solutions
│   ├── development/             # Development and testing guides
│   └── archived/                # Historical documents
├── notion-idea-server/          # 🖥️ MCP server implementation
├── director-mcp-server/         # 🎯 Director MCP server (workflow orchestration)
├── orchestrator/                # 🤖 AI pipeline runner (Claude agents + MySQL history)
│   ├── src/
│   │   ├── agents/              # Director (classify/evaluate) + Validator agents
│   │   ├── db/                  # MySQL connection, workflow store, schema.sql
│   │   ├── pipelines/           # categorize-idea pipeline
│   │   ├── models/              # Claude API wrapper (ask / askJSON)
│   │   ├── workflow.ts          # withRetry utility
│   │   ├── notion-client.ts     # Notion API integration
│   │   └── index.ts             # CLI entry point
│   └── env.template             # Environment variable template
├── n8n/workflows/               # 🔁 n8n automation workflows
└── scripts/                     # 🔧 Docker startup scripts
```

## 🚀 Quick Start

### **🐳 One-Command Docker Setup (Recommended)**

```bash
# Start complete MCP Server + AI Agents ecosystem
./scripts/start-full-project.sh

# Or quick silent startup
./scripts/quick-start.sh
```

**✅ This starts:**
- **Main MCP Server** (stdio mode for direct MCP clients)
- **HTTP API Server** (port 3001 for n8n agents)
- **Director MCP Server** (port 3002 for workflow orchestration)
- **n8n AI Platform** (port 5678 for workflows)
- **MySQL** (port 3306 for orchestrator history)

**🌐 Access URLs:**
- n8n Platform: http://localhost:5678
- Notion MCP HTTP API: http://localhost:3001
- Director MCP HTTP API: http://localhost:3002

### **🔧 Development Setup**

```bash
# Start with hot reload for coding
./scripts/start-development.sh
```

### **📚 Manual Setup**

1. **📖 Read the docs**: Start with [docs/README.md](./docs/README.md)
2. **⚙️ Setup MCP Server**: Follow [notion-idea-server/README.md](./notion-idea-server/README.md)
3. **🔗 Configure n8n**: Use [docs/setup/N8N_SETUP_GUIDE.md](./docs/setup/N8N_SETUP_GUIDE.md)
4. **🎯 Import Workflow**: Load the main workflow file
5. **🧪 Test System**: Use the testing configurations

---

## 🤖 Orchestrator — AI Pipeline Runner

The `orchestrator/` directory is a standalone CLI tool that runs multi-agent AI pipelines directly against Claude. It is separate from the n8n workflow system and is designed to be run locally or on a schedule.

### How It Works

Each pipeline runs a sequence of AI agents (Director → Validator → Evaluator) in a feedback loop. Results are written back to Notion. Every execution is tracked in MySQL with a full stage-by-stage audit log.

```
CLI → Pipeline → FETCH → PARSE → CLASSIFY → VALIDATE → EVALUATE → WRITE
                                    ↑___________retry loop___________|
```

### Setup

**1. Start MySQL**
```bash
docker compose up mysql -d
# Schema is auto-loaded on first startup from orchestrator/src/db/schema.sql
```

**2. Configure environment**
```bash
cp orchestrator/env.template orchestrator/.env
# Fill in:
#   ANTHROPIC_API_KEY   — your Anthropic key
#   NOTION_API_URL      — http://localhost:3001 (or the running HTTP server URL)
#   MYSQL_HOST          — localhost
#   MYSQL_PASSWORD      — orchestrator (matches docker-compose default)
```

**3. Install dependencies**
```bash
cd orchestrator && npm install
```

**4. Run a pipeline**
```bash
# Process a single Notion page by ID
npx tsx src/index.ts categorize-idea --id <notion-page-id>

# Process all unprocessed ideas
npx tsx src/index.ts categorize-idea --all

# Dry run (no writes to Notion or MySQL)
npx tsx src/index.ts categorize-idea --id <id> --dry-run
```

### Workflow History (MySQL)

Every run is stored in two tables:

| Table | Purpose |
|---|---|
| `workflow_runs` | One row per execution — status, current stage, cached stage outputs |
| `workflow_events` | Immutable audit log — every stage start/complete/fail with duration |

**Useful queries:**
```sql
-- All runs for a Notion page
SELECT id, status, current_stage, started_at, completed_at
FROM workflow_runs WHERE notion_page_id = 'your-id';

-- Full audit trail for a run
SELECT stage, status, attempt, duration_ms, created_at
FROM workflow_events WHERE run_id = 'your-run-id' ORDER BY id;

-- Recent failures across all runs
SELECT r.notion_page_name, e.stage, e.error_message, e.created_at
FROM workflow_events e
JOIN workflow_runs r ON r.id = e.run_id
WHERE e.status = 'FAILED'
ORDER BY e.created_at DESC LIMIT 20;

-- Runs that need manual review
SELECT notion_page_name, started_at FROM workflow_runs
WHERE status = 'NEEDS_REVIEW' ORDER BY started_at DESC;
```

**Connect to MySQL directly:**
```bash
docker exec -it orchestrator-mysql mysql -u orchestrator -porchestrator orchestrator
```

### Key Design Principles

- **Idempotency**: If a run is already `RUNNING` for a Notion page, the pipeline skips it — no duplicate processing.
- **Activity retries**: Each Claude API call is independently wrapped with `withRetry` (3 attempts, exponential backoff). A single rate-limit error won't fail the whole pipeline.
- **Graceful degradation**: If `MYSQL_HOST` is not set, all DB calls silently no-op. The pipeline runs normally — you just won't have history.

---

## 🤖 AI Agent System

### Core Components
- **🎯 Intelligent Director**: Routes tasks to specialized agents
- **📝 Notion Agent**: Processes and categorizes ideas  
- **📊 Planner Agent**: Strategic planning and decomposition
- **✅ Validation Agent**: Quality assurance and consistency

### Current Implementation
**Status**: ✅ **Fully Functional**  
**Features**: Multi-agent workflow with intelligent routing, daily processing, Notion integration  
**Description**: Complete system for automated idea processing and categorization

## 🏆 Key Features

### ✅ Currently Working
- **Multi-Agent Workflow**: Intelligent Director routes tasks to specialized agents
- **Daily Processing**: Automated daily idea processing with `daysBack=1` scoping
- **Notion Integration**: Safe property detection and updates
- **Error Handling**: Comprehensive debugging and graceful error recovery
- **Testing Framework**: Unit tests with multi-MCP server architecture support

### 🔄 Processing Modes
- **Daily Mode**: Process only today's unprocessed ideas (default)
- **Weekly Mode**: Process ideas from the past week
- **Manual Mode**: Flexible testing with custom date ranges

## 🐳 Docker Management Scripts

### **Available Scripts**

| **Script** | **Purpose** | **Use Case** |
|------------|-------------|--------------|
| `./scripts/start-full-project.sh` | **Complete Setup** | AI agents & workflows |
| `./scripts/start-development.sh` | **Development Mode** | Hot reload coding |
| `./scripts/quick-start.sh` | **Silent Startup** | Fast testing |
| `./scripts/stop-all.sh` | **Clean Shutdown** | Stop everything |

### **Docker Desktop Integration**

All containers are clearly visible in Docker Desktop:
- `mcp-notion-idea-server` - Main MCP server (stdio)
- `mcp-notion-idea-server-http` - HTTP API server (port 3001)
- `mcp-director-server-http` - Director MCP HTTP API (port 3002)
- `n8n-server` - AI workflow platform (port 5678)
- `orchestrator-mysql` - Workflow history database (port 3306)

### **Usage Examples**

```bash
# 🚀 Start everything for AI agents
./scripts/start-full-project.sh

# 🔧 Start development environment with hot reload  
./scripts/start-development.sh

# ⚡ Quick silent startup (no prompts)
./scripts/quick-start.sh

# 🛑 Stop all containers
./scripts/stop-all.sh
```

### **Configuration Requirements**

Before running scripts, ensure:
1. **Docker Desktop** is running
2. **Environment file** exists: `./notion-idea-server/.env`
   ```bash
   cp ./notion-idea-server/env.template ./notion-idea-server/.env
   # Edit with your Notion credentials
   ```

## 🐛 Common Issues & Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| **"Misconfigured placeholder" errors** | Use embedded URL parameters instead of separate query config |
| **Notion property validation errors** | Server auto-detects properties and handles case variations |
| **Daily/weekly processing confusion** | Workflow now defaults to daily mode (`daysBack=1`) |

## 🔧 Docker Support

### Individual Server Management
```bash
cd notion-idea-server/
./scripts/docker-build.sh                  # Build server
./scripts/docker-run.sh                    # Run in production mode
./scripts/docker-run.sh --dev              # Run in development mode
```

### Hub-Level Management
```bash
./scripts/manage-hub.sh build              # Build all servers
./scripts/manage-hub.sh start              # Start all servers  
./scripts/manage-hub.sh status             # Show server status
```

## 🧪 Testing

Quick testing for the MCP server:

```bash
cd notion-idea-server

# Run basic tests
npm test

# Run with Jest (if dependencies installed)
npm run test:jest

# Run tests with coverage
npm run test:coverage
```

**For detailed testing instructions**, see [Testing Configurations](./docs/development/TESTING_CONFIGURATIONS.md).

## 🤝 Contributing

### Adding Documentation
1. **Choose the right folder** in `docs/`:
   - `setup/` - Installation and configuration
   - `troubleshooting/` - Error fixes and solutions
   - `development/` - Development and testing guides
   - `archived/` - Historical documents

2. **Follow consistent formatting** with emojis, clear sections, and code examples
3. **Update the documentation index** in `docs/README.md`

### Development Guidelines
1. **Test thoroughly**: Use the comprehensive testing framework
2. **Document changes**: Update relevant documentation
3. **Follow patterns**: Match existing code and configuration styles
4. **Multi-server ready**: Consider the planned multi-MCP server architecture

## 📞 Support

- **📚 Documentation**: Start with [docs/README.md](./docs/README.md)
- **🐛 Issues**: Check [troubleshooting guides](./docs/troubleshooting/)
- **💡 Examples**: Review [working examples](./n8n/workflows/examples/)

---

**Status**: ✅ **Production Ready**
**Version**: 1.1 - Multi-Agent Orchestrator with MySQL Workflow History
**Last Updated**: April 2026