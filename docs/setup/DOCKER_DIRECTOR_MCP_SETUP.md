# Director MCP Server Docker Integration Guide

## 🎯 Overview

The Director MCP Server is now fully integrated into the Docker-based MCP Server ecosystem, providing intelligent workflow orchestration and multi-agent coordination through containerized deployment.

## 🏗️ Architecture

### **Service Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                    MCP Network                          │
├─────────────────┬─────────────────┬─────────────────────┤
│  Notion MCP     │  Director MCP   │     n8n Workflow    │
│  Server         │  Server         │     Platform        │
│  Port: 3001     │  Port: 3002     │     Port: 5678      │
│  ┌─────────────┐│  ┌─────────────┐│  ┌─────────────────┐│
│  │   stdio     ││  │ HTTP API    ││  │   Web UI        ││
│  │   + HTTP    ││  │ + MCP Tools ││  │   + Workflows   ││
│  └─────────────┘│  └─────────────┘│  └─────────────────┘│
└─────────────────┴─────────────────┴─────────────────────┘
```

### **Container Configuration**

#### **Production Containers**
- **`mcp-director-server`**: Production Director MCP Server
- **`mcp-notion-idea-server-http`**: Notion MCP Server (HTTP API)
- **`n8n-server`**: n8n Workflow Platform

#### **Development Containers**  
- **`mcp-director-server-dev`**: Development with hot reload
- **`mcp-notion-idea-server-http-dev`**: Notion development mode
- **Development profiles**: Activated with `--profile dev`

---

## 🚀 Quick Start

### **Production Deployment**
```bash
# Start all services including Director MCP Server
./scripts/start-full-project.sh

# Expected output:
# ✅ Director MCP Server: healthy (port 3002)
# 🎯 Director MCP API: http://localhost:3002
```

### **Development Mode**
```bash
# Start development environment with hot reload
./scripts/start-development.sh

# Expected output:
# ✅ Director MCP Server (dev): healthy (port 3002)
# Hot reload enabled for all TypeScript changes
```

### **Testing Docker Setup**
```bash
# Comprehensive Docker setup test
./scripts/test-docker-setup.sh

# Tests 10 different aspects of Docker integration
# Expected: 10/10 tests passing
```

---

## 📋 Docker Configuration Details

### **docker-compose.yml - Production Service**

```yaml
director-mcp-server:
  build:
    context: ./director-mcp-server
    dockerfile: Dockerfile
  container_name: mcp-director-server
  restart: unless-stopped
  
  environment:
    - NODE_ENV=production
    - SERVER_NAME=director-mcp-server
    - PORT=3002
  
  ports:
    - "3002:3002"
  
  volumes:
    - ./director-mcp:/app/director-mcp:ro
    - ./docs:/app/docs:ro
    - director_logs:/app/logs
  
  networks:
    - mcp-network
  
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 15s
  
  depends_on:
    - notion-idea-server-http
```

### **Key Features**

#### **🔒 Security & Reliability**
- **Non-root user**: Runs as `director:nodejs` user (UID 1001)
- **Health checks**: Automated monitoring with curl-based checks
- **Resource limits**: 512M memory, 1.0 CPU limit
- **Restart policy**: `unless-stopped` for high availability

#### **📁 Volume Management**  
- **Template files**: `./director-mcp` → `/app/director-mcp` (read-only)
- **Documentation**: `./docs` → `/app/docs` (read-only)  
- **Logs**: `director_logs` → `/app/logs` (persistent)
- **Hot reload**: Source code mounted in development mode

#### **🌐 Network Configuration**
- **Network**: `mcp-network` (shared bridge network)
- **Port mapping**: `3002:3002` (Director MCP API)
- **Service discovery**: Labeled for container orchestration
- **Dependencies**: Starts after Notion MCP Server

---

## 🛠️ Development Integration

### **Hot Reload Development**

The development setup provides hot reload for both Notion and Director MCP servers:

```bash
# Start development containers
./scripts/start-development.sh

# Expected development features:
✅ Hot Reload: Edit .ts files → changes apply instantly
✅ Volume Mounted: ./director-mcp-server/src → /app/src  
✅ TypeScript Support: nodemon + ts-node
✅ Debugging: Full source maps and logging
```

### **Development Workflow**

1. **Edit Source Code**:
   ```bash
   # Director MCP Server changes
   vim director-mcp-server/src/index.ts
   
   # Notion MCP Server changes  
   vim notion-idea-server/src/notion-service.ts
   ```

2. **Changes Apply Automatically**:
   - Nodemon detects file changes
   - TypeScript compilation happens on-the-fly
   - Server restarts automatically
   - Health checks validate the restart

3. **Test Changes**:
   ```bash
   # Test Director endpoints
   ./testing/test-director-endpoints.sh
   
   # Check logs
   docker-compose logs -f director-mcp-server-dev
   ```

### **Development Commands**

```bash
# View development logs
docker-compose logs -f director-mcp-server-dev
docker-compose logs -f notion-idea-server-http-dev

# Rebuild development containers  
docker-compose build director-mcp-server-dev --no-cache

# Stop development services
docker-compose --profile dev down

# Start only Director in dev mode
docker-compose --profile dev up -d director-mcp-server-dev
```

---

## 🔍 Health Monitoring

### **Health Check Endpoints**

#### **Director MCP Server Health**
```bash
curl http://localhost:3002/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-09-03T20:00:00.000Z",
  "services": {
    "template_manager": "healthy",
    "context_manager": "healthy", 
    "agent_communicator": "healthy"
  }
}
```

#### **System Statistics**
```bash
curl http://localhost:3002/api/stats

# Expected response:
{
  "uptime_seconds": 3600,
  "template_cache": {
    "hit_rate": "95%",
    "cached_templates": 3
  },
  "active_contexts": 5,
  "agent_communication": {
    "successful_calls": 150,
    "failed_calls": 2
  }
}
```

### **Docker Health Integration**

Docker automatically monitors container health:

```bash
# Check container health status
docker inspect mcp-director-server --format='{{.State.Health.Status}}'

# Expected: "healthy"

# View health check history
docker inspect mcp-director-server | jq '.State.Health'
```

---

## 🧪 Testing Integration

### **Automated Testing Suite**

The Docker integration includes comprehensive testing:

```bash
# Test Docker setup (10 comprehensive tests)
./scripts/test-docker-setup.sh

# Test Director endpoints (9 API tests)  
./testing/test-director-endpoints.sh

# n8n visual workflow testing
# Import: n8n/workflows/director-mcp-test.json
```

### **Test Coverage**

#### **Docker Setup Tests**
1. ✅ **Docker availability** - Docker daemon running
2. ✅ **Build process** - Container builds successfully  
3. ✅ **Service startup** - All containers start properly
4. ✅ **Health checks** - All services respond to health checks
5. ✅ **Template loading** - Workflow templates load correctly
6. ✅ **Agent communication** - Inter-service communication works
7. ✅ **Container health** - Docker health checks pass
8. ✅ **Logging** - Container logs accessible
9. ✅ **Volume mounting** - Template files properly mounted
10. ✅ **Cleanup** - Services stop cleanly

#### **API Integration Tests**  
- Template loading (15KB → 2.5KB optimization)
- Instruction creation for agents
- Context management and persistence
- Agent health monitoring
- Error handling and recovery

---

## 🐛 Troubleshooting

### **Common Issues & Solutions**

#### **🔴 Director Container Won't Start**

**Symptoms**:
```bash
docker-compose up director-mcp-server
# Error: Container exits immediately
```

**Solutions**:
```bash
# Check build logs
docker-compose build director-mcp-server --no-cache

# Check runtime logs  
docker-compose logs director-mcp-server

# Verify template files exist
ls -la director-mcp/workflow-templates/

# Check port conflicts
lsof -i :3002
```

#### **🔴 Health Checks Failing**

**Symptoms**:
```bash
curl http://localhost:3002/health
# curl: (7) Failed to connect to localhost port 3002
```

**Solutions**:
```bash
# Check container status
docker ps | grep director

# Check container health
docker inspect mcp-director-server --format='{{.State.Health.Status}}'

# Check internal connectivity
docker exec mcp-director-server curl -f http://localhost:3002/health

# Check logs for startup errors
docker-compose logs director-mcp-server | tail -20
```

#### **🔴 Template Loading Issues**

**Symptoms**:
```bash
curl -X POST http://localhost:3002/api/mcp/get-workflow-template \
  -d '{"workflow_type": "idea_categorization"}'
# {"success": false, "error": "Template not found"}
```

**Solutions**:
```bash
# Verify volume mounts
docker exec mcp-director-server ls -la /app/director-mcp/workflow-templates/

# Check template files
ls -la director-mcp/workflow-templates/

# Rebuild with fresh volumes
docker-compose down -v
docker-compose up -d director-mcp-server

# Clear template cache
curl -X POST http://localhost:3002/api/admin/clear-cache
```

#### **🔴 Agent Communication Issues**

**Symptoms**:
```bash
curl http://localhost:3002/api/agents/health
# {"success": false, "error": "Unable to reach agents"}
```

**Solutions**:
```bash
# Check network connectivity
docker exec mcp-director-server ping mcp-notion-idea-server-http

# Verify Notion MCP Server is running
docker ps | grep notion
curl http://localhost:3001/health

# Check network configuration
docker network inspect mcp-servers-network

# Restart with proper dependencies
docker-compose down
docker-compose up -d notion-idea-server-http director-mcp-server
```

### **Resource Issues**

#### **🔴 Memory Limits**

**Symptoms**:
```bash
docker stats mcp-director-server
# Memory usage: 500MB+/512MB limit
```

**Solutions**:
```bash
# Increase memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 1G  # Increased from 512M
      
# Monitor memory usage
docker stats --no-stream mcp-director-server
```

#### **🔴 Port Conflicts**

**Symptoms**:
```bash
docker-compose up director-mcp-server  
# Error: Port 3002 is already in use
```

**Solutions**:
```bash
# Find process using port
lsof -i :3002

# Kill conflicting process  
sudo kill -9 $(lsof -t -i:3002)

# Use alternative port in docker-compose.yml
ports:
  - "3003:3002"  # Map to different host port
```

---

## 📊 Monitoring & Maintenance

### **Log Management**

```bash
# View real-time logs
docker-compose logs -f director-mcp-server

# View recent logs with timestamps
docker-compose logs --timestamps --tail=100 director-mcp-server

# Export logs for analysis
docker-compose logs director-mcp-server > director-logs.txt

# Log rotation (automatic via Docker)
# Configured in docker-compose.yml:
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### **Performance Monitoring**

```bash
# Container resource usage
docker stats mcp-director-server

# System performance impact
docker system df
docker system prune  # Clean up unused resources

# Network performance
docker exec mcp-director-server ping -c 5 mcp-notion-idea-server-http
```

### **Updates & Maintenance**

```bash
# Update to latest code
git pull
docker-compose build director-mcp-server --no-cache
docker-compose up -d director-mcp-server

# Database-style maintenance (template cache)
curl -X POST http://localhost:3002/api/admin/clear-cache

# Full system restart
./scripts/start-full-project.sh
```

---

## 🎯 Production Deployment

### **Pre-Deployment Checklist**

- [ ] **Docker tests pass**: `./scripts/test-docker-setup.sh`
- [ ] **API tests pass**: `./testing/test-director-endpoints.sh`  
- [ ] **Template files present**: Check `director-mcp/workflow-templates/`
- [ ] **Resource limits set**: Memory and CPU limits configured
- [ ] **Health checks enabled**: Container health monitoring active
- [ ] **Log management**: Rotation and retention configured
- [ ] **Network security**: Proper container networking
- [ ] **Backup strategy**: Volume backup for logs and templates

### **Production Environment Variables**

```bash
# Add to docker-compose.yml production overrides
environment:
  - NODE_ENV=production
  - LOG_LEVEL=info
  - CACHE_TTL=7200
  - MAX_CONCURRENT_AGENTS=10
  - TEMPLATE_CACHE_SIZE=50
```

### **High Availability Setup**

For production high availability:

```yaml
# docker-compose.prod.yml
director-mcp-server:
  restart: always
  deploy:
    replicas: 2
    resources:
      limits:
        memory: 1G
        cpus: '2.0'
    restart_policy:
      condition: on-failure
      max_attempts: 3
```

---

## 🎉 Success Metrics

### **What Success Looks Like**

#### **✅ Container Health**
- All containers start within 30 seconds
- Health checks pass consistently (>99% uptime)
- Memory usage stays within limits (<80% of allocated)
- No container restarts or crashes

#### **✅ Functional Performance**
- Template loading: <100ms response time
- Instruction creation: <200ms response time  
- Agent communication: <500ms response time
- Context management: <50ms for updates

#### **✅ System Integration**
- Docker setup tests: 10/10 passing
- API endpoint tests: 9/9 passing
- n8n workflow imports successfully
- Inter-service communication established

#### **✅ Development Experience**
- Hot reload working (<2s after save)
- Source maps available for debugging
- Logs accessible and readable
- Easy container management

---

**The Director MCP Server is now fully integrated into the Docker ecosystem, providing production-ready intelligent workflow orchestration with comprehensive development tooling!** 🚀

**Next Steps:**
1. **Start services**: `./scripts/start-full-project.sh`
2. **Test integration**: `./scripts/test-docker-setup.sh`
3. **Import n8n workflow**: `director-mcp-test.json`
4. **Begin orchestrating**: Multi-agent workflows ready!
