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
├── n8n/workflows/              # 🤖 AI agent workflows
│   ├── simplified-intelligent-director.json  # Main workflow
│   └── examples/               # Working examples and patterns
└── scripts/                    # 🔧 Management scripts
```

## 🚀 Quick Start

1. **📖 Read the docs**: Start with [docs/README.md](./docs/README.md)
2. **⚙️ Setup MCP Server**: Follow [notion-idea-server/README.md](./notion-idea-server/README.md)
3. **🔗 Configure n8n**: Use [docs/setup/N8N_SETUP_GUIDE.md](./docs/setup/N8N_SETUP_GUIDE.md)
4. **🎯 Import Workflow**: Load the main workflow file
5. **🧪 Test System**: Use the testing configurations

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
**Version**: 1.0 - Multi-Agent Intelligent Director System  
**Last Updated**: January 2025 