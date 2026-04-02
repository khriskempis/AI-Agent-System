# Agent Templates

This folder contains verified, working agent configurations that serve as the master templates for all n8n workflows.

## 📁 Structure

```
agent-templates/
├── README.md                    # This file
├── template-schema.json         # JSON schema for template validation
├── director-agent-template.json # Master Director agent configuration
├── notion-agent-template.json   # Master Notion agent configuration
├── validation-agent-template.json # Future validation agent
├── planner-agent-template.json  # Future planner agent
└── tools/                       # Reusable tool configurations
    ├── notion-tools/
    ├── director-tools/
    └── common-tools/
```

## 🎯 Purpose

**SINGLE SOURCE OF TRUTH** for agent configurations:
- ✅ Prevent recreating broken configurations
- ✅ Ensure consistency across all workflows
- ✅ Version control agent improvements
- ✅ Enable automated workflow generation

## 📋 Template Format

Each agent template follows this structure:

```json
{
  "agent_metadata": {
    "agent_type": "director",
    "version": "1.0.0",
    "last_tested": "2025-01-08",
    "tested_by": "assistant",
    "description": "Multi-agent workflow orchestrator",
    "status": "verified"
  },
  "node_config": {
    "name": "Director Agent",
    "type": "@n8n/n8n-nodes-langchain.agent",
    "parameters": { /* exact n8n node configuration */ }
  },
  "required_tools": [
    "get-workflow-template",
    "update-context",
    "get-system-stats"
  ],
  "dependencies": {
    "services": ["mcp-director-server-http:3002"],
    "models": ["openai/gpt-4o-mini"]
  }
}
```

## 🔄 Workflow Integration

1. **Extract verified configs** from working individual agent tests
2. **Save as templates** in this folder
3. **Reference templates** when building new workflows
4. **Use sync script** to validate workflow consistency

## 🧪 Testing Protocol

Before marking an agent as "verified":
1. ✅ Individual agent test passes
2. ✅ Integration test with other agents passes  
3. ✅ All tools function correctly
4. ✅ Error handling works
5. ✅ Performance is acceptable

## 🚀 Usage

```bash
# Check consistency against templates
scripts/sync-agent-configs.sh

# Generate new workflow from templates
scripts/generate-workflow.sh --agents director,notion --output new-workflow.json

# Update workflow to use latest templates
scripts/update-workflow-from-templates.sh existing-workflow.json
```

## 📝 Maintenance

- Update version when agent configuration changes
- Re-test thoroughly before updating template
- Document all changes in version history
- Keep deprecated versions for rollback capability
