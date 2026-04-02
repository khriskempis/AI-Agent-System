# Workflow Configuration Management

## 🎯 Purpose

This system manages **testing** vs **production** configurations for n8n workflows, allowing easy switching between environments without manually editing workflow files.

## 📁 Structure

```
config/
├── README.md                    # This documentation
├── environments.json            # Environment definitions
├── config-switcher.js          # Utility to switch configs
├── testing/                     # Testing configurations
│   ├── director-notion-unified-agent.json
│   └── multi-agent-workflow-system.json
└── production/                  # Production configurations
    ├── director-notion-unified-agent.json
    └── multi-agent-workflow-system.json
```

## 🔧 Key Differences

### **Testing Configuration:**
- **Director URL:** `http://localhost:3002`
- **Notion URL:** `http://localhost:3001`
- **Database IDs:** Real testing database IDs
- **Timeout:** Lower values for faster iteration
- **Debug:** More verbose logging
- **Limits:** Smaller processing limits

### **Production Configuration:**
- **Director URL:** `http://mcp-director-server-http:3002`
- **Notion URL:** `http://mcp-notion-idea-server-http:3001`
- **Database IDs:** Production database IDs
- **Timeout:** Production-appropriate values
- **Debug:** Minimal logging
- **Limits:** Full processing capacity

## 🚀 Usage

### **Switch to Testing:**
```bash
cd n8n/workflows/config
node config-switcher.js --env testing --workflow director-notion-unified-agent
```

### **Switch to Production:**
```bash
cd n8n/workflows/config
node config-switcher.js --env production --workflow director-notion-unified-agent
```

### **Switch All Workflows:**
```bash
node config-switcher.js --env testing --all
```

## 📋 Configuration Schema

Each environment configuration defines:

```json
{
  "environment": "testing|production",
  "services": {
    "director": {
      "url": "service_url",
      "timeout": milliseconds
    },
    "notion": {
      "url": "service_url", 
      "timeout": milliseconds
    }
  },
  "databases": {
    "source": "database_id",
    "targets": {
      "projects": "database_id",
      "knowledge": "database_id", 
      "journal": "database_id"
    }
  },
  "processing": {
    "limit": number,
    "maxIterations": number,
    "debug": boolean
  }
}
```

## 🔄 Workflow

1. **Develop with testing config** - Use localhost URLs and test databases
2. **Validate functionality** - Ensure everything works in testing
3. **Switch to production config** - Use Docker service names and prod databases
4. **Deploy** - Production-ready workflow

## 🛡️ Benefits

- **No manual URL editing** - Automated configuration switching
- **Environment consistency** - Standardized testing vs production setups
- **Version control friendly** - Clear separation of configs
- **Deployment safety** - Prevents accidentally deploying test configs
- **Easy rollback** - Quick switching between environments

## 📝 Maintenance

When adding new workflows:
1. Create both testing and production variants
2. Add to `environments.json`
3. Update `config-switcher.js` if needed
4. Document any new configuration parameters
