# Director MCP Server Testing Guide

## 🎯 Overview

This guide provides comprehensive testing strategies for the Director MCP Server, including automated n8n workflows, Postman collections, and command-line testing scripts.

## 📁 Testing Resources

### **Files Created**:
1. **n8n Test Workflow**: `n8n/workflows/director-mcp-test.json`
2. **Postman Collection**: `testing/Director-MCP-Server-Postman-Collection.json`
3. **Command-Line Tests**: `testing/test-director-endpoints.sh`
4. **This Guide**: `testing/TESTING_GUIDE.md`

---

## 🚀 Quick Start Testing

### **Option 1: Automated Command-Line Tests**

**Fastest way to test all endpoints:**

```bash
# Make sure Director MCP Server is running
./scripts/start-director-mcp.sh

# Run comprehensive endpoint tests
./testing/test-director-endpoints.sh
```

**Expected Output:**
```
🧪 Director MCP Server Endpoint Testing
==================================================
Test 1: Director Server Health Check
✅ PASSED (HTTP 200)

Test 2: Get Workflow Template  
✅ PASSED (HTTP 200)

... (9 total tests)

📊 Test Results Summary
Tests Passed: 9/9
Success Rate: 100%
🎉 ALL TESTS PASSED!
```

### **Option 2: n8n Visual Test Workflow**

**Visual workflow testing in n8n:**

1. **Import Workflow**:
   - Open n8n (http://localhost:5678)
   - Import `n8n/workflows/director-mcp-test.json`

2. **Run Test**:
   - Click "Execute Workflow"
   - Watch each test step execute
   - View comprehensive results analysis

3. **Expected Results**:
   - ✅ Health Check: Director server healthy
   - ✅ Template Loading: idea_categorization loaded (15KB → 2.5KB)
   - ✅ Instruction Creation: Focused JSON generated
   - ✅ Agent Health: All agents available
   - ✅ Workflow Execution: Complete end-to-end flow

### **Option 3: Postman Collection Testing**

**Detailed API testing:**

1. **Import Collection**:
   - Open Postman
   - Import `testing/Director-MCP-Server-Postman-Collection.json`

2. **Configure Variables**:
   ```
   director_server = http://localhost:3002
   source_database_id = 16cd7be3dbcd80e1aac9c3a95ffaa61a
   projects_database_id = 3cd8ea052d6d4b69956e89b1184cae75
   ```

3. **Run Tests**:
   - Start with "Health & Status" folder
   - Progress through "MCP Tools"
   - Test "Agent Communication"
   - Verify "Context Management"

---

## 🧪 Detailed Testing Scenarios

### **1. Core MCP Tools Testing**

#### **Template Loading Test**
```bash
curl -X POST http://localhost:3002/api/mcp/get-workflow-template \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_type": "idea_categorization",
    "cache_duration": 3600
  }'
```

**Expected Response:**
- ✅ `success: true`
- ✅ `data.workflow_id: "idea_categorization_v1"`
- ✅ `data.phases: [...]` (complete workflow definition)
- ✅ Response size: ~15KB

#### **Instruction Creation Test**
```bash
curl -X POST http://localhost:3002/api/mcp/create-agent-instructions \
  -H "Content-Type: application/json" \
  -d '{
     "workflow_type": "idea_categorization",
    "target_agent": "notion",
    "parameters": {
      "source_database_id": "16cd7be3dbcd80e1aac9c3a95ffaa61a",
      "limit": 1
    }
  }'
```

**Expected Response:**
- ✅ `success: true`
- ✅ `data.agent_id: "notion"`
- ✅ `data.categorization_methodology: {...}` (extracted methodology)
- ✅ Response size: ~2.5KB (83% reduction!)

#### **Full Workflow Execution Test**
```bash
curl -X POST http://localhost:3002/api/mcp/execute-workflow \
  -H "Content-Type: application/json" \
  -d '{
     "workflow_type": "idea_categorization",
    "target_agent": "notion",
    "parameters": {
      "source_database_id": "16cd7be3dbcd80e1aac9c3a95ffaa61a",
      "limit": 1
    }
  }'
```

**Expected Response:**
- ✅ `success: true`
- ✅ `data.context_id: "ctx_..."` (workflow context created)
- ✅ `data.agent_response: {...}` (agent execution results)
- ✅ `data.workflow_complete: true/false` (completion status)

### **2. Agent Communication Testing**

#### **Agent Health Check**
```bash
curl http://localhost:3002/api/agents/health
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
      "summary": {
      "total_agents": 3,
      "healthy_agents": 1,
      "health_percentage": 33
    },
    "agent_results": {
      "notion": { "success": true },
      "planner": { "success": false },
      "validation": { "success": false }
    }
  }
}
```

#### **Send Instructions to Agent**
```bash
curl -X POST http://localhost:3002/api/agents/notion/execute \
  -H "Content-Type: application/json" \
  -d @testing/sample-instructions.json
```

### **3. Context Management Testing**

#### **List Active Contexts**
```bash
curl http://localhost:3002/api/context
```

#### **Get Specific Context**
```bash
curl http://localhost:3002/api/context/ctx_12345
```

#### **Get Agent-Specific Context**
```bash
curl http://localhost:3002/api/context/ctx_12345/agent/notion
```

### **4. Error Handling Testing**

#### **Invalid Template Test**
```bash
curl -X POST http://localhost:3002/api/mcp/get-workflow-template \
  -H "Content-Type: application/json" \
  -d '{"workflow_type": "nonexistent_template"}'
```

**Expected Response:**
- ✅ HTTP 400 or 404
- ✅ `success: false`
- ✅ `error: "Workflow template not found"`

#### **Unknown Agent Test**
```bash
curl -X POST http://localhost:3002/api/agents/unknown_agent/execute \
  -H "Content-Type: application/json" \
  -d '{"instruction": {"task_type": "test"}}'
```

---

## 📊 Performance Testing

### **Template Size Reduction Test**

1. **Load Template** (15KB response)
2. **Create Instructions** (2.5KB response)  
3. **Calculate Reduction**: `((15KB - 2.5KB) / 15KB) * 100 = 83%`

### **Cache Performance Test**

```bash
# First call (cache miss)
time curl -X POST http://localhost:3002/api/mcp/get-workflow-template \
  -H "Content-Type: application/json" \
  -d '{"workflow_type": "idea_categorization"}'

# Second call (cache hit - should be much faster)
time curl -X POST http://localhost:3002/api/mcp/get-workflow-template \
  -H "Content-Type: application/json" \
  -d '{"workflow_type": "idea_categorization"}'
```

### **Agent Response Time Test**

Monitor `execution_time_ms` in agent responses:
- ✅ **Good**: < 30 seconds
- ⚠️ **Acceptable**: 30-60 seconds  
- ❌ **Slow**: > 60 seconds

---

## 🔍 Troubleshooting Guide

### **Common Issues**

#### **1. Director Server Not Responding**
```bash
# Check if server is running
curl http://localhost:3002/health

# If not running:
./scripts/start-director-mcp.sh
```

#### **2. Template Loading Fails**
```bash
# Check template files exist
ls -la director-mcp/workflow-templates/

# Expected files:
# - idea-categorization-v1.json
# - template-registry.json
```

#### **3. Agent Communication Fails**
```bash
# Check agent health
curl http://localhost:3002/api/agents/health

# Check individual agent
curl http://localhost:3002/api/agents/notion/health

# Check if Notion MCP Server is running
curl http://localhost:3001/health

# Check if n8n is running  
curl http://localhost:5678/healthz
```

#### **4. Context Management Issues**
```bash
# List all active contexts
curl http://localhost:3002/api/context

# Check system stats
curl http://localhost:3002/api/stats
```

### **Debug Commands**

```bash
# Check Director server logs
tail -f director-mcp-server/logs/combined.log

# Check system stats
curl http://localhost:3002/api/stats | jq

# Clear template cache
curl -X POST http://localhost:3002/api/admin/clear-cache

# Test with minimal parameters
curl -X POST http://localhost:3002/api/mcp/get-workflow-template \
  -H "Content-Type: application/json" \
  -d '{"workflow_type": "idea_categorization"}'
```

---

## 🎯 Test Scenarios by Use Case

### **Scenario 1: First-Time Setup Validation**

**Goal**: Verify Director MCP Server is working correctly

**Tests**:
1. ✅ Health check passes
2. ✅ Template loading works
3. ✅ Instruction creation works
4. ✅ Basic agent communication established

**Commands**:
```bash
./testing/test-director-endpoints.sh
```

### **Scenario 2: Agent Integration Testing**

**Goal**: Test real agent communication

**Tests**:
1. ✅ Notion Agent receives instructions
2. ✅ Agent processes instructions correctly  
3. ✅ Director receives agent response
4. ✅ Context updates properly

**Method**: Use n8n workflow or Postman collection

### **Scenario 3: Performance Validation**

**Goal**: Verify efficiency improvements

**Tests**:
1. ✅ Template size reduction (83%)
2. ✅ Cache performance (sub-millisecond)
3. ✅ Agent response times (< 30s)
4. ✅ Memory usage acceptable

**Method**: Performance-focused Postman tests

### **Scenario 4: Error Recovery Testing**

**Goal**: Test system resilience

**Tests**:
1. ✅ Invalid template handling
2. ✅ Agent timeout recovery
3. ✅ Network failure handling
4. ✅ Malformed request handling

**Method**: Error-focused test cases

---

## 📝 Test Results Documentation

### **Expected Success Criteria**

#### **Core Functionality**
- ✅ Director server health: `200 OK`
- ✅ Template loading: `15KB → 2.5KB (83% reduction)`
- ✅ Instruction creation: Valid JSON with methodology
- ✅ Agent communication: HTTP 200 responses
- ✅ Context management: Proper state tracking

#### **Performance Metrics**
- ✅ Template cache hit rate: > 90%
- ✅ Agent response time: < 30 seconds
- ✅ Context update time: < 1 second
- ✅ Memory usage: < 512MB
- ✅ Error rate: < 5%

#### **Integration Health**
- ✅ Notion MCP Server: Reachable
- ✅ n8n Server: Reachable  
- ✅ Template files: Accessible
- ✅ Database IDs: Valid

### **Test Report Format**

```
Director MCP Server Test Report
=====================================
Date: 2025-09-03
Tester: [Your Name]
Environment: Development

Core Tests: ✅ PASSED (9/9)
- Health Check: ✅
- Template Loading: ✅  
- Instruction Creation: ✅
- Agent Communication: ✅
- Context Management: ✅

Performance Tests: ✅ PASSED
- Size Reduction: 83% ✅
- Cache Performance: < 1ms ✅
- Response Times: < 30s ✅

Integration Tests: ✅ PASSED
- Notion MCP Server: Available ✅
- n8n Server: Available ✅
- Template Files: Accessible ✅

Overall Status: ✅ SYSTEM READY
```

---

## 🚀 Next Steps After Testing

### **If All Tests Pass**:
1. **Deploy to Production**: Director MCP Server is ready
2. **Integrate with Director Agent**: Use MCP tools in actual Director
3. **Add New Workflows**: Create additional template types
4. **Scale Testing**: Test with multiple concurrent workflows

### **If Tests Fail**:
1. **Review Error Messages**: Check specific failure details
2. **Check Dependencies**: Ensure all services are running
3. **Verify Configuration**: Check database IDs and endpoints  
4. **Consult Logs**: Review server logs for detailed errors

**The comprehensive test suite ensures the Director MCP Server is production-ready for intelligent multi-agent workflow orchestration!** 🎯