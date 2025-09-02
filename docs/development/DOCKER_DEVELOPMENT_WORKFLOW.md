# Docker Development Workflow Guide

> **Complete guide**: Step-by-step workflows for MCP Server development with hot reload, troubleshooting, and best practices.

## 🚀 **DAILY STARTUP WORKFLOW**

### **Step 1: Start Your Development Session**
```bash
cd "/Users/kkempis/Desktop/Coding Practice/MCP Server"

# Start development HTTP server with hot reload
docker-compose --profile dev up -d notion-idea-server-http-dev

# View logs to confirm startup
docker-compose logs -f notion-idea-server-http-dev
```

**What you should see:**
```
🚀 Notion Ideas HTTP API running on port 3001 [DEVELOPMENT MODE]
📖 Health check: http://localhost:3001/health
💡 Ideas API: http://localhost:3001/api/ideas
✅ Notion API connection verified
```

### **Step 2: Verify Everything is Working**
```bash
# Test health endpoint (should show detailed comprehensive checks)
curl -s http://localhost:3001/health | jq .

# Test ideas API
curl -s http://localhost:3001/api/ideas/summary | jq .
```

### **Step 3: Begin Coding**
- Edit any `.ts` files in `notion-idea-server/src/`
- **Changes auto-reload** - no rebuilds needed! ✅
- Watch logs for restart confirmations: `Restarting 'src/http-wrapper.ts'`

---

## 🔄 **DEVELOPMENT WORKFLOW FOR CHANGES**

### **✅ Normal Code Changes (Auto-Reload)**
1. **Edit any `.ts/.js` files** in `src/`
2. **Save the file**
3. **Watch logs** - you'll see:
   ```
   Restarting 'src/http-wrapper.ts'
   Received SIGTERM, shutting down HTTP server...
   🚀 Notion Ideas HTTP API running on port 3001 [DEVELOPMENT MODE]
   ```
4. **Test immediately** - changes are live!

### **❌ Package Changes (Rebuild Required)**
```bash
# 1. Add the package locally first
cd notion-idea-server
npm install new-package-name

# 2. Stop development container
cd ../
docker-compose stop notion-idea-server-http-dev

# 3. Rebuild with new packages
docker-compose build notion-idea-server-http-dev --no-cache

# 4. Restart development
docker-compose --profile dev up -d notion-idea-server-http-dev
```

### **⚙️ Configuration Changes (Rebuild Required)**
For `Dockerfile`, `tsconfig.json`, or `docker-compose.yml` changes:
```bash
docker-compose stop notion-idea-server-http-dev
docker-compose build notion-idea-server-http-dev --no-cache
docker-compose --profile dev up -d notion-idea-server-http-dev
```

### **🔄 Environment Changes (Restart Only)**
For `.env` file changes:
```bash
docker-compose restart notion-idea-server-http-dev
```

---

## 🎯 **Quick Decision Matrix**

|| Change Type | Development Mode | Action Required |
|-------------|------------------|-----------------|
|| **Edit .ts/.js files** | ✅ **Auto-reload** | Just save the file |
|| **Add npm package** | ❌ **Rebuild needed** | `npm install` → rebuild container |
|| **Edit .env file** | ✅ **Restart only** | `docker-compose restart` |
|| **Edit Dockerfile/tsconfig** | ❌ **Rebuild needed** | `docker-compose build --no-cache` |

---

## 🚨 **TROUBLESHOOTING: "MY CHANGES AREN'T SHOWING UP!"**

This is the most common frustration. Here's how to diagnose and fix it:

### **Issue 1: Using Production Container Instead of Development**

**Problem**: Making code changes but they require Docker rebuilds to appear.

**Solution**: Switch to development container with hot reload.

```bash
# Check what's running
docker-compose ps

# If you see 'notion-idea-server-http' (production), stop it
docker-compose stop notion-idea-server-http

# Start development container instead
docker-compose --profile dev up -d notion-idea-server-http-dev
```

**How to identify**: 
- ❌ Logs show: `🚀 Notion Ideas HTTP API running on port 3001` (no [DEVELOPMENT MODE])
- ✅ Should show: `🚀 Notion Ideas HTTP API running on port 3001 [DEVELOPMENT MODE]`

### **Issue 2: Container Not Rebuilding After Package Changes**

**Problem**: Added npm packages but getting "Module not found" errors.

**Solution**:
```bash
# Stop container
docker-compose stop notion-idea-server-http-dev

# Force rebuild without cache
docker-compose build notion-idea-server-http-dev --no-cache

# Start fresh
docker-compose --profile dev up -d notion-idea-server-http-dev
```

### **Issue 3: Hot Reload Not Working**

**Problem**: Development mode but changes still don't appear.

**Diagnosis**:
```bash
# Check if volumes are mounted correctly
docker exec -it mcp-notion-idea-server-http-dev ls -la /app/src

# Check if tsx is watching
docker-compose logs notion-idea-server-http-dev | grep -i restart
```

**Solution**: Rebuild container - volume mounts may not be working.

### **Issue 4: Port Already In Use**

**Problem**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Find what's using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>

# OR stop all Docker containers
docker-compose down
```

### **Issue 5: Basic Health Check Instead of Comprehensive**

**Problem**: Health endpoint returns basic status instead of detailed checks.

**Diagnosis**: Check if comprehensive health checker is being used:
```bash
curl -s http://localhost:3001/health | jq .checks
```

**Solution**: 
- If no `.checks` field: Using wrong health endpoint or error in ComprehensiveHealthCheck
- Check logs: `docker-compose logs notion-idea-server-http-dev`

---

## 📋 **COMMON DAILY COMMANDS**

### **Starting Work**
```bash
cd "/Users/kkempis/Desktop/Coding Practice/MCP Server"
docker-compose --profile dev up -d notion-idea-server-http-dev
docker-compose logs -f notion-idea-server-http-dev
```

### **Checking Status**
```bash
# What's running?
docker-compose ps

# View logs
docker-compose logs notion-idea-server-http-dev --tail=20

# Test endpoints
curl -s http://localhost:3001/health | jq .status
curl -s http://localhost:3001/api/ideas/summary | jq .totalIdeas
```

### **Making Changes**
```bash
# Just edit files and save - they auto-reload!
# Watch logs for confirmation:
docker-compose logs -f notion-idea-server-http-dev
```

### **When Things Go Wrong**
```bash
# Nuclear option - clean restart
docker-compose down
docker-compose build notion-idea-server-http-dev --no-cache
docker-compose --profile dev up -d notion-idea-server-http-dev

# Check everything is clean
docker system prune -f
```

### **End of Day**
```bash
# Stop development containers (optional - they restart automatically)
docker-compose stop notion-idea-server-http-dev

# Or stop everything
docker-compose down
```

---

## 🏗️ **Architecture Overview**

### **Container Modes Available:**

1. **Development HTTP** (`notion-idea-server-http-dev`) - **RECOMMENDED FOR DAILY WORK**
   - ✅ Hot reload via `tsx --watch`
   - ✅ Volume mounts for instant changes
   - ✅ Port 3001 exposed
   - ✅ Comprehensive health checks
   - ❌ Requires rebuild for package changes

2. **Production HTTP** (`notion-idea-server-http`)
   - ❌ No hot reload - requires rebuilds
   - ✅ Optimized production build
   - ✅ Full TypeScript compilation

3. **Development MCP** (`notion-idea-server-dev`)
   - ✅ Hot reload for MCP server
   - ❌ No HTTP endpoints
   - ✅ Direct MCP protocol testing

### **File Change Impact:**

| File Type | Development Mode | Action Needed |
|-----------|------------------|---------------|
| `src/**/*.ts` | ✅ Auto-reload | None - save file |
| `package.json` | ❌ Rebuild | `npm install` + rebuild |
| `.env` | ✅ Restart | `docker-compose restart` |
| `Dockerfile` | ❌ Rebuild | Build with `--no-cache` |
| `tsconfig.json` | ❌ Rebuild | Build with `--no-cache` |
| `docker-compose.yml` | ❌ Rebuild | Rebuild affected services |

---

## 🔧 **Advanced Troubleshooting**

### **Debug Container Issues**
```bash
# Execute commands inside container
docker exec -it mcp-notion-idea-server-http-dev /bin/sh

# Check volume mounts
docker inspect mcp-notion-idea-server-http-dev | grep -A 10 "Mounts"

# Check if typescript files are accessible
docker exec -it mcp-notion-idea-server-http-dev find /app/src -name "*.ts"
```

### **Performance Issues**
```bash
# Check resource usage
docker stats

# Check container logs for memory/cpu warnings
docker-compose logs notion-idea-server-http-dev | grep -i warning
```

### **Network Issues**
```bash
# Test internal Docker networking
docker exec -it mcp-notion-idea-server-http-dev wget -qO- http://localhost:3001/health

# Check port mapping
docker port mcp-notion-idea-server-http-dev
```

---

## 📊 **Development vs Production Comparison**

### **When to Use Development Mode** (Default for daily work)
- ✅ Making code changes
- ✅ Testing new features
- ✅ Debugging issues
- ✅ Faster iteration cycles

### **When to Use Production Mode**
- ⚡ Final testing before deployment
- ⚡ Performance testing
- ⚡ Simulating production environment
- ⚡ Validating build process

### **Commands for Mode Switching**
```bash
# Switch to development (from production)
docker-compose stop notion-idea-server-http
docker-compose --profile dev up -d notion-idea-server-http-dev

# Switch to production (from development)  
docker-compose stop notion-idea-server-http-dev
docker-compose up -d notion-idea-server-http
```

---

## ✅ **Best Practices Summary**

1. **Always use development mode** for daily coding
2. **Watch the logs** to confirm changes are reloading
3. **Only rebuild when required** (packages, config changes)
4. **Test endpoints immediately** after changes
5. **Use `--no-cache`** when rebuilding after package changes
6. **Keep production mode** for final testing only

---

## 📖 **Related Documentation**

- [N8N Setup Guide](../setup/N8N_SETUP_GUIDE.md) - Setting up AI agents
- [API Endpoints](../setup/API_ENDPOINTS.md) - MCP Server HTTP API reference
- [Testing Configurations](TESTING_CONFIGURATIONS.md) - Testing strategies
- [Health Checks README](../../notion-idea-server/src/health-checks/README.md) - Health monitoring details

---

*Last updated: January 2, 2025*
*This guide reflects the current development setup with hot reload capabilities and comprehensive health checks.*