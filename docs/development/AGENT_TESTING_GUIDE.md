# Agent Testing & Sync Guide

## 🎯 **Testing Workflow**

### **Pre-Testing Setup**
1. **Start your MCP Server**:
   ```bash
   ./scripts/start-full-project.sh
   ```
   
2. **Verify Services are Running**:
   - MCP Server: http://localhost:3001/health
   - n8n Platform: http://localhost:5678
   - Ideas API: http://localhost:3001/api/ideas?limit=5

### **Testing Order**
1. ✅ **Notion Agent** (Database connectivity)
2. ✅ **Director Agent** (Routing decisions) 
3. **Integration Test** (Director → Notion)
4. **Main Workflow Sync**

---

## 🔧 **Notion Agent Testing**

### **Test Steps**
1. **Import Workflow**: Load `notion-agent.json` into n8n
2. **Check API Connectivity**: Verify MCP server responds
3. **Run Manual Test**: Click "Test workflow" button
4. **Analyze Results**: Check tool usage and output quality

### **Expected Success Criteria**
- ✅ **MCP Tools Used**: get_ideas, get_idea_by_id, search_ideas, update_idea
- ✅ **Status Workflow**: Mentions "Not Started", "In Progress", "Done"  
- ✅ **Multi-Idea Parsing**: References methodology
- ✅ **Score**: 60%+ overall performance
- ✅ **Structured Output**: Comprehensive response (100+ chars)

### **Common Issues & Fixes**
| Issue | Solution |
|-------|----------|
| **MCP Connection Failed** | Start MCP server: `./scripts/start-full-project.sh` |
| **Low Tool Usage Score** | Check API endpoints, verify port 3001 accessible |
| **No Structured Output** | Review agent system message, check Claude API keys |
| **Agent Not Found** | Verify workflow imported and activated in n8n |

---

## 🧭 **Director Agent Testing**

### **Test Steps**
1. **Import Workflow**: Load `director-agent.json` into n8n
2. **Run Manual Test**: Click "Test workflow" button  
3. **Check JSON Output**: Verify routing decision format
4. **Validate Routing Logic**: Confirm agent selection reasoning

### **Expected Success Criteria**
- ✅ **Valid JSON**: Produces parseable routing decision
- ✅ **Required Fields**: primaryAgent, taskDescription, reasoning, priority
- ✅ **Routing Logic**: Routes to "notion" for idea processing tasks
- ✅ **Status**: PASSED overall test result

### **Sample Expected Output**
```json
{
  "routingDecision": {
    "primaryAgent": "notion",
    "taskDescription": "Check for 'Not Started' ideas from today (daysBack=1), process and categorize them using multi-idea parsing methodology",
    "reasoning": "Notion Agent has the tools and expertise for idea database operations",
    "followUpAgent": "validation",
    "priority": "medium",
    "estimatedComplexity": "moderate"
  },
  "contextUpdate": {
    "currentPhase": "agent_coordination",
    "nextSteps": "Execute agent task and consolidate results"
  }
}
```

---

## 🔄 **Configuration Sync Process**

### **Key Differences to Monitor**

| Component | Individual Test | Main Workflow | Action Required |
|-----------|----------------|---------------|-----------------|
| **Language Model** | GPT-4o Mini (Notion) | Claude Sonnet | Keep separate for testing |
| **System Messages** | Identical required | Identical required | ✅ Sync automatically |
| **Tool Descriptions** | Identical required | Identical required | ✅ Sync automatically |
| **Temperature Settings** | Test optimized | Production optimized | Different values OK |

### **Auto-Sync Checklist**
- [ ] **Notion Agent System Message**: Identical between files
- [ ] **Director Agent System Message**: Identical between files  
- [ ] **MCP Tool Descriptions**: Match exactly
- [ ] **Tool URLs**: Same endpoints and parameters
- [ ] **Agent Parameters**: maxIterations, core settings

---

## 🧪 **Integration Testing**

### **Phase 1: Director → Notion Test**
1. Test Director Agent produces valid routing to "notion"
2. Test Notion Agent handles the routed task
3. Verify task completion and status updates

### **Phase 2: Full Workflow Test**
1. Import main `simplified-intelligent-director.json`
2. Run with manual trigger
3. Verify end-to-end execution
4. Check shared context preservation

---

## 📊 **Success Metrics**

### **Individual Agent Targets**
- **Notion Agent**: 70%+ tool usage, successful API calls
- **Director Agent**: Valid JSON output, correct routing logic
- **Planner Agent**: Strategic analysis, structured planning
- **Validation Agent**: Quality assessment, issue detection

### **Integration Targets**  
- **Routing Accuracy**: Director selects optimal agents
- **Context Preservation**: Shared data maintained across agents
- **Error Handling**: Graceful failure recovery
- **Performance**: Complete workflow < 60 seconds

---

## 🔧 **Troubleshooting Quick Reference**

### **Database Connection Issues**
```bash
# Test MCP server
curl http://localhost:3001/api/ideas?limit=1

# Check Docker containers  
docker ps | grep mcp-notion

# Restart if needed
./scripts/stop-all.sh && ./scripts/start-full-project.sh
```

### **n8n Agent Issues**
- **Check Credentials**: Anthropic/OpenAI API keys configured
- **Verify Workflows**: Imported and activated correctly
- **Review Logs**: n8n execution logs for detailed errors
- **Test Manually**: Use "Test workflow" before automation

### **Configuration Drift**
- **Run sync check**: Compare individual vs main workflow configs
- **Update systematically**: Apply changes to both individual and main files
- **Test after sync**: Verify functionality after configuration updates

---

## 🎯 **Next Steps After Testing**

1. **✅ Individual Tests Pass**: Each agent works in isolation
2. **🔄 Sync Configurations**: Ensure main workflow matches tested configs  
3. **🏗️ Integration Testing**: Test agent combinations
4. **🚀 Production Ready**: Deploy main workflow with confidence

---

**Remember**: Individual tests use different models (GPT-4o Mini vs Claude) for cost efficiency, but system messages and tool configurations must stay synchronized with the main workflow.
