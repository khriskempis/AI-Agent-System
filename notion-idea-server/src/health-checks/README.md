# Health Check System

This folder contains different health check implementations for the Notion MCP Server. The current implementation uses **Option B: Comprehensive Health Check**.

## Current Implementation (Active)

**File**: `comprehensive-health.ts` - ✅ **Currently Used**

**Features**:
- ✅ Notion API connectivity testing
- ✅ Database access verification  
- ✅ Database schema validation
- ✅ Environment variable checks
- ✅ Memory usage monitoring
- ✅ Response time tracking
- ✅ Request metrics (total requests, error rate, avg response time)
- ✅ Detailed status reporting (healthy/degraded/unhealthy)

**Response Format**:
```json
{
  "status": "healthy|degraded|unhealthy",
  "service": "notion-idea-server-http",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 12345,
  "checks": {
    "notion_connectivity": { "status": "pass", "message": "...", "duration_ms": 123 },
    "database_access": { "status": "pass", "message": "...", "duration_ms": 456 },
    "database_schema": { "status": "pass", "message": "...", "duration_ms": 78 },
    "environment": { "status": "pass", "message": "..." },
    "memory": { "status": "pass", "message": "..." },
    "response_time": { "status": "pass", "message": "..." }
  },
  "metrics": {
    "total_requests": 42,
    "error_rate": 2.5,
    "avg_response_time": 156
  }
}
```

## Alternative Options (Available)

### Option A: Basic Health Check
**File**: `basic-health.ts`

**Features**:
- ⚡ Fast and lightweight
- ✅ Basic Notion connectivity
- ✅ Environment validation
- ✅ Simple status determination

**Use Case**: When you need simple up/down status with minimal overhead.

### Option C: Performance-Focused Health Check  
**File**: `performance-health.ts`

**Features**:
- ⚡ Smart caching (30s default)
- ✅ Performance metrics (P50, P95, avg response times)
- ✅ Requests per minute tracking
- ✅ Optimized for frequent health checks

**Use Case**: When you need detailed performance metrics with fast response times.

## How to Switch Options

To change health check implementations, update `http-wrapper.ts`:

1. **Change the import**:
   ```typescript
   // Current (Comprehensive)
   import { ComprehensiveHealthCheck } from './health-checks/comprehensive-health.js';
   
   // Alternative (Basic)  
   import { BasicHealthCheck } from './health-checks/basic-health.js';
   
   // Alternative (Performance)
   import { PerformanceHealthCheck } from './health-checks/performance-health.js';
   ```

2. **Update the initialization**:
   ```typescript
   // Current (Comprehensive)
   const healthChecker = new ComprehensiveHealthCheck(notionService);
   
   // Alternative (Basic)
   const healthChecker = new BasicHealthCheck(notionService);
   
   // Alternative (Performance) 
   const healthChecker = new PerformanceHealthCheck(notionService, 30000);
   ```

3. **Update the endpoint call**:
   ```typescript
   // For Basic/Comprehensive
   const health = await healthChecker.checkHealth();
   
   // For Performance (supports caching)
   const health = await healthChecker.getHealth(forceRefresh);
   ```

## Testing the Health Endpoint

Once your server is running, test the health endpoint:

```bash
# Basic health check
curl http://localhost:3001/health

# Pretty-printed JSON
curl http://localhost:3001/health | jq

# Check HTTP status codes
curl -I http://localhost:3001/health
```

**Status Codes**:
- `200`: healthy or degraded
- `503`: unhealthy

## Health Status Definitions

- **healthy**: All checks pass ✅
- **degraded**: Some checks fail or warnings present ⚠️  
- **unhealthy**: Multiple critical failures ❌

## Implementation Details

The comprehensive health check (current) includes:
- **Real-time testing**: Each health check makes actual API calls
- **Automatic metrics**: Request tracking via Express middleware
- **Error handling**: Proper TypeScript error type checking
- **Performance monitoring**: Response time and memory tracking
- **Schema validation**: Ensures database properties match expected structure


