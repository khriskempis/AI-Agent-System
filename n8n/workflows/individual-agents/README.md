# Individual Agent Testing Guide

This directory contains standalone workflows for testing each AI agent independently before integrating them into the main multi-agent workflow.

## 🎯 **Purpose**

Individual agent testing allows you to:
- **Verify each agent works correctly** in isolation
- **Debug specific agent issues** without workflow complexity
- **Test different prompts and configurations** quickly
- **Confirm MCP tool connectivity** for each agent
- **Validate agent specializations** and capabilities

## 📁 **Available Test Workflows**

### 1. **Director Agent** (`director-agent.json`)
**Purpose**: Test intelligent routing and decision-making
- **Tests**: JSON output parsing, routing logic, agent coordination
- **Webhook**: `POST /test-director`
- **Specialization**: Pure orchestrator with no direct tool access

### 2. **Notion Agent** (`notion-agent.json`)
**Purpose**: Test MCP tool integration and idea processing
- **Tests**: All MCP tools, multi-idea parsing, status workflow
- **Webhook**: `POST /test-notion`
- **Specialization**: Complete Notion database operations

### 3. **Planner Agent** (`planner-agent.json`)
**Purpose**: Test strategic planning and task decomposition
- **Tests**: Planning methodologies, analytical thinking, structured output
- **Webhook**: `POST /test-planner`
- **Specialization**: Strategic analysis and execution planning

### 4. **Validation Agent** (`validation-agent.json`)
**Purpose**: Test quality assurance and consistency checking
- **Tests**: Data validation, issue detection, quality metrics
- **Webhook**: `POST /test-validation`
- **Specialization**: Quality assurance and error detection

## 🚀 **How to Test Each Agent**

### **Step 1: Import Individual Workflows**
1. Open n8n workspace
2. Import each JSON file as a separate workflow
3. Activate each workflow to enable webhooks

### **Step 2: Test Each Agent**

Each agent workflow now uses **Manual Triggers** and connects to your existing MCP server at `http://host.docker.internal:3001/api/ideas`.

#### **Testing Process**
1. **Import the workflow** into n8n
2. **Click the "Test workflow" button** in n8n interface
3. **Review the test results** in the workflow output

#### **Agent Test Configurations**

**Director Agent Test**
- **Task**: "Test daily idea processing workflow" 
- **Tests**: JSON routing decisions, agent coordination logic
- **Expected**: Valid routing to Notion Agent with proper reasoning

**Notion Agent Test (GPT-4o Mini)**
- **Task**: "Check for Not Started ideas from today, process and categorize them"
- **Tests**: All MCP tools, multi-idea parsing, status workflow
- **Expected**: Active tool usage, idea processing, status updates

**Planner Agent Test**
- **Task**: "Analyze provided data and create strategic plan for execution"
- **Test Data**: "Sample project: Build personal productivity dashboard with Notion integration"
- **Expected**: Strategic planning, task decomposition, structured output

**Validation Agent Test**
- **Task**: "Validate recent idea processing results and check for quality issues"
- **Test Data**: "15 ideas processed, 12 as Project, 2 as Journal, 1 as General"
- **Expected**: Quality analysis, issue detection, recommendations

## 📊 **Understanding Test Results**

### **Success Indicators**
- ✅ **Status: PASSED** - Agent performed correctly
- **High scores** (60%+ for most agents, 65%+ for Validation)
- **Tool usage** - Agent used MCP tools appropriately
- **Structured output** - Agent provided organized responses
- **Specialization focus** - Agent demonstrated domain expertise

### **Failure Indicators**
- ❌ **Status: FAILED** - Agent needs improvement
- **Low scores** (< 50%)
- **Missing elements** - Key capabilities not demonstrated
- **No tool usage** - MCP connectivity issues
- **Poor output quality** - Brief or unfocused responses

## 🔧 **Troubleshooting Common Issues**

### **MCP Server Connection Issues**
```bash
# Test MCP server directly
curl http://localhost:3001/api/ideas?limit=5

# Check Docker networking
docker ps | grep mcp-notion
```

### **Agent Configuration Issues**
- **Check Claude API credentials** in each workflow
- **Verify system messages** are properly formatted
- **Confirm tool descriptions** match actual MCP endpoints
- **Review temperature settings** (Director: 0.3, Notion: 0.3, Planner: 0.4, Validation: 0.2)

### **Template Syntax Errors**
- **Escape curly braces** in JSON examples (use `{{` and `}}`)
- **Check placeholder definitions** for proper formatting
- **Verify URL parameters** are embedded correctly

## 🔄 **Integration Workflow**

Once all individual agents pass testing:

### **Step 1: Verify Individual Agent Tests**
- [ ] Director Agent: Produces valid JSON routing decisions
- [ ] Notion Agent: Successfully uses all MCP tools
- [ ] Planner Agent: Demonstrates strategic planning capabilities
- [ ] Validation Agent: Identifies quality issues and provides recommendations

### **Step 2: Test Agent Combinations**
- Test Director → Notion routing
- Test Notion → Validation workflow
- Test Director → Planner → Validation chain

### **Step 3: Integrate into Main Workflow**
- Copy successful configurations to `simplified-intelligent-director.json`
- Update shared context handling
- Test complete multi-agent workflow

## 🛠️ **Customization Options**

### **Modify Test Tasks**
Edit the webhook POST data to test different scenarios:
```json
{
  "task": "Your custom task description",
  "data": "Optional test data for context"
}
```

### **Adjust Agent Parameters**
- **Temperature**: Control creativity vs consistency
- **Max tokens**: Adjust response length limits
- **System messages**: Customize agent specializations
- **Tool descriptions**: Modify MCP tool behavior

### **Add Custom Validation**
Modify the analysis code nodes to test for specific capabilities or requirements.

## 📈 **Performance Metrics**

Track these metrics across agent tests:
- **Response time**: How quickly agents respond
- **Tool usage frequency**: Which tools are most used
- **Success rates**: Percentage of passing tests
- **Output quality**: Length and structure of responses
- **Specialization accuracy**: How well agents stay in their domain

## 🔮 **Next Steps**

After successful individual testing:
1. **Optimize configurations** based on test results
2. **Create agent integration tests** for multi-agent workflows
3. **Establish continuous testing** for agent reliability
4. **Monitor performance** in production multi-agent system

---

**Individual Testing**: ✅ **Complete Setup**  
**Agent Isolation**: ✅ **Independent Validation**  
**Integration Ready**: ✅ **Verified Components**  
**Production Ready**: ✅ **Quality Assured** 