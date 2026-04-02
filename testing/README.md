# MCP Server Testing Suite

Organized testing infrastructure for the MCP Server project components.

## 📁 Directory Structure

```
testing/
├── 📊 database-testing/          # Database endpoint testing
│   ├── test-database-endpoints.ts    # TypeScript database tests
│   ├── test_database_creation.py     # Python database tests (legacy)
│   ├── DATABASE_ENDPOINT_TESTING.md  # Database testing docs
│   └── ENDPOINT_TESTING_GUIDE.md     # Endpoint testing guide
├── 🎯 director-testing/          # Director MCP server testing
│   └── test-director-endpoints.sh    # Director endpoint tests
├── 📮 postman-collections/       # Postman test collections
│   ├── Director-MCP-Server-Postman-Collection.json
│   └── Director-MCP-Server-Tests.postman_collection.json
├── 📄 example-data/              # Sample JSON data for testing
│   ├── project_item_example.json
│   ├── knowledge_item_example.json
│   └── journal_item_example.json
├── 🔧 scripts/                   # Shell scripts and utilities
│   ├── quick-test.sh                 # Quick system health check
│   ├── quick-database-test.sh        # Quick database test
│   └── test-database-endpoints.sh    # Database endpoint script
├── 📚 docs/                      # Documentation
│   └── TESTING_GUIDE.md              # Comprehensive testing guide
├── package.json                  # Node.js dependencies and scripts
└── README.md                     # This file
```

## 🚀 Quick Start

### Database Testing (Recommended)
```bash
# Run comprehensive database tests with rich content
npm run test:database

# Quick database connectivity test
npm run test:database:quick
```

### Director Testing
```bash
# Test Director MCP server endpoints
npm run test:director
```

### System Health Check
```bash
# Quick test of all systems
npm run quick-test
```

### All Tests
```bash
# Run all available tests
npm run test:all
```

## 🎯 Phase 2 Workflow Testing

For testing the **n8n Phase 2 workflow** (database item creation):

1. **Validate database endpoints** (already done ✅):
   ```bash
   npm run test:database
   ```

2. **Import n8n workflow**:
   - File: `../n8n/workflows/director-notion-phase2-workflow.json`
   - Or: `../n8n/workflows/director-notion-complete-workflow.json`

3. **Test workflow execution** in n8n interface

## 📊 Database Configuration

Current validated database IDs:
- **Projects**: `3cd8ea052d6d4b69956e89b1184cae75` ✅
- **Knowledge**: `263d7be3dbcd80c0b6e4fd309a8af453` ✅  
- **Journal**: `a1d35f6081a044589425512cb9d136b7` ✅

## 🔧 Dependencies

- **Node.js**: TypeScript testing infrastructure
- **tsx**: TypeScript execution
- **axios**: HTTP client for API testing
- **curl**: Command-line HTTP testing
- **jq**: JSON processing (optional, for pretty output)

## 📚 Documentation

- **Database Testing**: `database-testing/DATABASE_ENDPOINT_TESTING.md`
- **Comprehensive Guide**: `docs/TESTING_GUIDE.md`
- **Endpoint Guide**: `database-testing/ENDPOINT_TESTING_GUIDE.md`

---

**Ready to test Phase 2 database creation workflow!** 🎯