# MCP Server Project Scripts

> **Quick setup scripts for running your MCP Server + AI Agents ecosystem**
> 
> 📚 **See also**: [Main Project Documentation](../README.md) | [Docker Development Workflow](../docs/development/DOCKER_DEVELOPMENT_WORKFLOW.md)

## 🚀 **Main Scripts**

### **`./scripts/start-production.sh`** 🆕 **New**
**Dedicated production environment**
- ✅ Production HTTP services (ports 3001, 3002)
- ✅ n8n AI Workflow Platform (port 5678)
- ✅ **Automatic workflow configuration for production**
- ✅ Production settings (higher limits, timeouts)
- ✅ Docker service URLs configured automatically
- **Use this for:** Production deployment and testing

### **`./scripts/start-full-project.sh`** ⭐ **Enhanced**
**Complete project setup for AI agents**
- ✅ Notion MCP HTTP API Server (port 3001)
- ✅ n8n AI Workflow Platform (port 5678)  
- ✅ Health checks and status validation
- ✅ All containers visible in Docker Desktop
- ✅ **Automatic workflow configuration for production**
- **Use this for:** Running AI agents and workflows

### **`./scripts/start-development.sh`** ⭐ **Complete Development Environment**
**Everything you need for development + workflow testing**
- ✅ Notion development container with tsx hot reload
- ✅ Notion HTTP API server (hot reload) → Port 3001
- ✅ Director HTTP API server (for n8n workflows) → Port 3002
- ✅ n8n workflow platform → Port 5678
- ✅ **Automatic workflow configuration for testing**
- ✅ localhost URLs configured automatically
- ✅ Testing settings (lower limits for faster iteration)
- ✅ Volume-mounted source code for hot reload
- **Use this for:** All development work including workflow testing

### **`./scripts/quick-start.sh`**
**Silent startup (no prompts)**
- ✅ Fast startup without interactive prompts
- ✅ Core services only
- **Use this for:** Quick testing or automation

### **`./scripts/stop-all.sh`**
**Clean shutdown**
- ✅ Stops all containers
- ✅ Optional cleanup
- **Use this for:** Shutting down everything

## 📋 **Usage Examples**

```bash
# Start full project for AI agents
./scripts/start-full-project.sh

# Start development environment  
./scripts/start-development.sh

# Quick start (no prompts)
./scripts/quick-start.sh

# Stop everything
./scripts/stop-all.sh
```

## 🌐 **Access URLs After Startup**

| Service | URL | Purpose |
|---------|-----|---------|
| **n8n Platform** | http://localhost:5678 | AI workflow interface |
| **MCP HTTP API** | http://localhost:3001 | API for n8n agents |
| **Health Check** | http://localhost:3001/health | Service status |
| **Ideas Summary** | http://localhost:3001/api/ideas/summary | Quick data test |

## 📦 **Docker Desktop Integration**

All scripts ensure containers are visible in Docker Desktop with clear names:
- `n8n-server` - AI workflow platform
- `mcp-notion-idea-server-http` - HTTP API for agents
- `mcp-notion-idea-server-dev` - Development container (dev mode only)

## 🔧 **Configuration Requirements**

Before running, ensure:
1. **Docker Desktop** is running
2. **Environment file** exists: `./notion-idea-server/.env`
   ```bash
   # Copy template and configure
   cp ./notion-idea-server/env.template ./notion-idea-server/.env
   ```

## 🎯 **Script Selection Guide**

**For AI Agents & Workflows:**
→ `./scripts/start-full-project.sh`

**For Code Development:**  
→ `./scripts/start-development.sh`

**For Quick Testing:**
→ `./scripts/quick-start.sh`

**To Stop Everything:**
→ `./scripts/stop-all.sh`

---

## 🔧 **Automatic Workflow Configuration** 🆕

All startup scripts now automatically configure your n8n workflows for the appropriate environment:

### **Development Scripts:**
- ✅ **`start-development.sh`** → Configures workflows for **testing**
  - URLs: `http://localhost:3001`, `http://localhost:3002`
  - Settings: Lower limits (3 ideas), faster timeouts
  - Perfect for: Local development and testing

### **Production Scripts:**
- ✅ **`start-production.sh`** → Configures workflows for **production**
- ✅ **`start-full-project.sh`** → Configures workflows for **production**
  - URLs: `http://mcp-director-server-http:3002`, `http://mcp-notion-idea-server-http:3001`
  - Settings: Higher limits (10 ideas), production timeouts
  - Perfect for: Deployment and production use

### **Manual Configuration (if needed):**
```bash
# Switch to testing manually
cd n8n/workflows/config
node config-switcher.js --env testing --all

# Switch to production manually  
cd n8n/workflows/config
node config-switcher.js --env production --all
```

## 🐛 **Troubleshooting**

**Script won't run?**
```bash
chmod +x scripts/*.sh
```

**Port conflicts?**  
Check if ports 3001 or 5678 are in use:
```bash
lsof -i :3001
lsof -i :5678
```

**Docker issues?**
```bash
docker system prune
./scripts/start-full-project.sh
```
