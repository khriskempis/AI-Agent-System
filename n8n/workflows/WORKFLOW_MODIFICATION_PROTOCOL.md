# N8N Workflow Modification Protocol

## 🚨 CRITICAL: Always Apply Development Config After Modifications

Whenever you modify any n8n workflow files (`.json` files in this directory), you **MUST** immediately apply development configurations to ensure proper service URLs.

## ⚡ Quick Command

From the project root, run:

```bash
./n8n/workflows/apply-dev-config.sh
```

Or manually:

```bash
cd n8n/workflows/config
node config-switcher.js --env testing --all
```

## 🎯 Why This Matters

### Without Applying Dev Config:
- ❌ Workflows use production service names: `mcp-director-server-http:3002`
- ❌ n8n can't connect (services not running in dev environment)
- ❌ Connection errors: "The connection cannot be established"

### With Dev Config Applied:
- ✅ Workflows use development service names: `mcp-director-server-http-dev:3002`
- ✅ n8n connects to running dev containers
- ✅ Workflows execute successfully

## 🔄 The Protocol

1. **Modify** any workflow `.json` file
2. **IMMEDIATELY run**: `./n8n/workflows/apply-dev-config.sh`
3. **Verify** URLs in workflow point to `-dev` services
4. **Test** workflow in n8n

## 🛠️ What the Script Does

- ✅ Applies development service URLs (`-dev` suffixes)
- ✅ Uses development timeouts and limits
- ✅ Creates automatic backups
- ✅ Updates all workflows consistently

## 📋 Service Name Mapping

| Environment | Director Service | Notion Service |
|-------------|------------------|----------------|
| **Development** | `mcp-director-server-http-dev:3002` | `mcp-notion-idea-server-http-dev:3001` |
| **Production** | `mcp-director-server-http:3002` | `mcp-notion-idea-server-http:3001` |

## 🎯 Automation

The development startup script (`scripts/start-development.sh`) automatically applies dev config, but manual workflow modifications require manual config application.

## ⚠️ Remember

**Never commit workflows with production URLs to development branches!**

Always ensure workflows are configured for the appropriate environment before testing or committing.

