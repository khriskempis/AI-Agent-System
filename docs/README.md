# MCP Server Documentation

Welcome to the MCP Server project documentation. This project provides an intelligent idea processing system using Notion and n8n workflows.

## 📂 Documentation Structure

### 🚀 [Setup & Configuration](./setup/)
Essential guides for getting the system running:

- **[N8N Setup Guide](./setup/N8N_SETUP_GUIDE.md)** - Complete guide for setting up n8n with Claude integration
- **[API Endpoints](./setup/API_ENDPOINTS.md)** - Reference for all MCP server endpoints
- **[Examples & Best Practices](../n8n/workflows/examples/README.md)** - Working examples and configuration patterns

### 🔧 [Troubleshooting](./troubleshooting/)
Solutions for common issues:

- **[Notion Property Fix](./troubleshooting/NOTION_PROPERTY_FIX.md)** - Resolving Notion property validation errors
- **[Workflow Fixes Summary](./troubleshooting/WORKFLOW_FIXES_SUMMARY.md)** - Complete guide to n8n workflow configuration fixes

### 🛠️ [Development](./development/)
Development and configuration guides:

- **[Daily Processing Modes](./development/DAILY_PROCESSING_MODES.md)** - Configure different processing schedules and modes
- **[Testing Configurations](./development/TESTING_CONFIGURATIONS.md)** - How to test different workflow scenarios

### 📚 [Archived](./archived/)
Historical documents and planning materials:

- **[Multi-Agent Workflow Plan](./archived/MULTI_AGENT_WORKFLOW_PLAN.md)** - Original architecture planning
- **[Monitoring Dashboard Design](./archived/MONITORING_DASHBOARD_DESIGN.md)** - Future monitoring concepts

## 🏗️ System Architecture

### Core Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   n8n Workflow │    │   MCP Server    │    │  Notion Database│
│   (AI Agents)   │◄──►│ (notion-idea-   │◄──►│   (Ideas)       │
│                 │    │  server)        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Features
- **🤖 Intelligent Director Agent**: Routes tasks to specialized agents
- **📝 Notion Agent**: Processes and categorizes ideas
- **📊 Planner Agent**: Strategic planning and task decomposition
- **✅ Validation Agent**: Quality assurance and consistency checks

## 🎯 Quick Start

1. **Setup MCP Server**: Follow the [Notion Idea Server README](../notion-idea-server/README.md)
2. **Configure n8n**: Use the [N8N Setup Guide](./setup/N8N_SETUP_GUIDE.md)
3. **Import Workflow**: Load `simplified-intelligent-director.json`
4. **Test & Run**: Use the [Testing Configurations](./development/TESTING_CONFIGURATIONS.md)

## 🔗 Key Workflows

### Daily Processing (Default)
- **Trigger**: Daily at 9 AM
- **Scope**: Today's unprocessed ideas (`daysBack=1`)
- **Purpose**: Process fresh ideas without duplicates

### Weekly Processing (Alternative)
- **Trigger**: Weekly (Mondays)
- **Scope**: Past week (`daysBack=7`)
- **Purpose**: Batch processing of accumulated ideas

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Misconfigured placeholder errors** | See [Workflow Fixes Summary](./troubleshooting/WORKFLOW_FIXES_SUMMARY.md) |
| **Notion property validation errors** | See [Notion Property Fix](./troubleshooting/NOTION_PROPERTY_FIX.md) |
| **Daily vs weekly processing confusion** | See [Daily Processing Modes](./development/DAILY_PROCESSING_MODES.md) |

## 📝 Contributing to Documentation

When adding new documentation:

1. **Choose the right folder**:
   - `setup/` - Installation and configuration guides
   - `troubleshooting/` - Error fixes and solutions
   - `development/` - Development and testing guides
   - `archived/` - Historical or deprecated content

2. **Use consistent formatting**:
   - Start with a clear title and brief description
   - Use emojis for visual organization
   - Include code examples where relevant
   - Add troubleshooting sections for complex topics

3. **Update this index** when adding new files

## 📊 Current Status

✅ **Working Features**:
- Multi-agent n8n workflow with intelligent routing
- Daily idea processing with proper date scoping
- Notion property auto-detection and safe updates
- Comprehensive error handling and debugging tools

🚧 **Future Enhancements**:
- Multi-MCP server architecture support
- Enhanced cost optimization with local LLMs
- Advanced monitoring and analytics dashboard

---

**Last Updated**: January 2025  
**Version**: 1.0 - Multi-Agent System with Daily Processing 