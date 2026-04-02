# Configuration Management Usage Guide

## 🚀 Quick Start

### **For Development/Testing:**
```bash
cd n8n/workflows/config
node config-switcher.js --env testing --workflow director-notion-unified-agent
```

### **For Production Deployment:**
```bash
cd n8n/workflows/config
node config-switcher.js --env production --workflow director-notion-unified-agent
```

### **Switch All Workflows:**
```bash
node config-switcher.js --env testing --all
```

## 📋 Common Commands

| Command | Purpose |
|---------|---------|
| `node config-switcher.js --list` | Show available environments and workflows |
| `node config-switcher.js --env testing --workflow <name>` | Switch specific workflow to testing |
| `node config-switcher.js --env production --workflow <name>` | Switch specific workflow to production |
| `node config-switcher.js --env testing --all` | Switch all workflows to testing |

## 🔄 Typical Workflow

### **1. Development Phase:**
```bash
# Start with testing configuration
node config-switcher.js --env testing --workflow director-notion-unified-agent

# Import workflow into n8n (http://localhost:5678)
# Test with localhost URLs and test databases
```

### **2. Production Deployment:**
```bash
# Switch to production configuration
node config-switcher.js --env production --workflow director-notion-unified-agent

# Workflow now uses Docker service names and production settings
# Deploy to production n8n instance
```

### **3. Back to Development:**
```bash
# Switch back to testing for further development
node config-switcher.js --env testing --workflow director-notion-unified-agent
```

## 🔧 Configuration Differences

| Setting | Testing | Production |
|---------|---------|------------|
| **Director URL** | `http://localhost:3002` | `http://mcp-director-server-http:3002` |
| **Notion URL** | `http://localhost:3001` | `http://mcp-notion-idea-server-http:3001` |
| **Processing Limit** | 3 ideas | 10 ideas |
| **Max Iterations** | 15 | 25 |
| **Timeouts** | Lower (faster feedback) | Higher (production stability) |
| **Database IDs** | Test databases | Production databases |

## 📦 Automatic Backups

Every configuration switch creates a backup:
- **Location:** `config/backups/`
- **Format:** `workflow-name-timestamp-pre-environment.json`
- **Purpose:** Easy rollback if needed

## 🛡️ Safety Features

- ✅ **Automatic backups** before any changes
- ✅ **Environment tags** added to workflows
- ✅ **Validation** of environment and workflow names
- ✅ **Clear logging** of all changes
- ✅ **Separate config files** for testing/production

## 📝 Adding New Workflows

1. **Add to `environments.json`:**
```json
"new-workflow-name": {
  "name": "New Workflow",
  "description": "Description",
  "configurable_nodes": ["Node1", "Node2"]
}
```

2. **Create testing version:**
```bash
cp new-workflow.json config/testing/
```

3. **Create production version:**
```bash
cp config/testing/new-workflow.json config/production/
# Edit URLs and settings for production
```

## 🔍 Troubleshooting

### **"Environment not found"**
- Check `environments.json` for available environments
- Use `--list` to see available options

### **"Workflow not found"**
- Ensure workflow file exists in main directory
- Check `environments.json` for workflow configuration

### **"Backup failed"**
- Check write permissions in `config/backups/`
- Ensure sufficient disk space

## 💡 Best Practices

1. **Always test first** - Use testing config before production
2. **Check backups** - Verify backups are created successfully
3. **Document changes** - Note any custom configuration changes
4. **Version control** - Commit configuration changes
5. **Validate URLs** - Ensure services are running on target URLs

---

**🎯 Ready for seamless environment switching!**
