# Daily Processing Configuration Guide

## 🚨 Current Issue
The workflow has a **mismatch** between daily execution and 7-day processing scope:
- **Daily Trigger**: Runs every day at 9 AM
- **Processing Scope**: Always looks at last 7 days (`daysBack=7`)
- **Result**: Reprocesses the same ideas multiple times

## 🎯 Processing Mode Options

### 1. **Daily Mode** (Recommended for Production)
Process only ideas from the current day to avoid duplicates.

**Configuration:**
- **Director Prompt**: `"Focus on today's unprocessed ideas. Check for 'Not Started' status ideas from today only (daysBack=1)."`
- **System Message**: Change `daysBack=7` to `daysBack=1`
- **Use Case**: Daily automation for fresh ideas

### 2. **Weekly Mode** (Good for Less Frequent Runs)
Process ideas from the past week, but only run weekly.

**Configuration:**
- **Trigger**: Change cron to `0 9 * * 1` (Mondays at 9 AM)
- **Keep**: `daysBack=7` in prompts
- **Use Case**: Weekly batch processing

### 3. **Testing Mode** (For Development/Testing)
Flexible date range for testing specific scenarios.

**Configuration:**
- **Dynamic Parameters**: Add configurable `daysBack` parameter
- **Manual Trigger**: Use manual execution with different date ranges
- **Use Case**: Testing different scenarios and date ranges

### 4. **Smart Mode** (Advanced)
Intelligently determine scope based on last successful run.

**Configuration:**
- **State Tracking**: Store last successful execution timestamp
- **Dynamic Range**: Calculate days since last run
- **Use Case**: Resilient processing that handles outages

## 🔧 Implementation Options

### Option A: Quick Fix (Daily Mode)
**Modify existing workflow for daily processing:**

1. **Change Director Prompt** (Line 168):
```
"Focus on today's unprocessed ideas. Check for 'Not Started' status ideas from today only, process them efficiently, and confirm completion."
```

2. **Change System Message Instructions**:
```
- **Priority**: Focus on 'Not Started' ideas from today only (daysBack=1)
- **Check Recent Ideas**: Use get_ideas with status='Not Started' and daysBack=1 to find today's unprocessed ideas
```

### Option B: Configurable Parameters
**Add dynamic date range configuration:**

1. **Add Parameter Node** before Director:
```json
{
  "parameters": {
    "assignments": {
      "assignments": [
        {
          "name": "processingDays",
          "value": "1",
          "type": "number"
        },
        {
          "name": "processingMode", 
          "value": "daily",
          "type": "string"
        }
      ]
    }
  }
}
```

2. **Dynamic Director Prompt**:
```
"Focus on unprocessed ideas from the last {{ $('Set Processing Parameters').item.json.processingDays }} day(s). Process efficiently and confirm completion."
```

### Option C: Testing Configuration
**For manual testing with flexible date ranges:**

1. **Manual Trigger Node** instead of Cron
2. **Input Parameters** for date range
3. **Testing Presets**:
   - `daysBack=1` (today only)
   - `daysBack=7` (this week)
   - `daysBack=30` (this month)

## 📅 Recommended Daily Schedule

### Production Daily Workflow:
```
6:00 AM - Trigger execution
6:01 AM - Process today's ideas (daysBack=1)
6:05 AM - Complete processing and report
```

### Weekly Cleanup:
```
Monday 7:00 AM - Weekly cleanup (daysBack=7)
Monday 7:10 AM - Validate all processed ideas
```

## 🧪 Testing Scenarios

### Test Single Day:
```
Manual execution with daysBack=1
```

### Test Current Week:
```
Manual execution with daysBack=7
```

### Test Specific Date Range:
```
Manual execution with custom date filters
```

## ⚙️ Configuration Examples

### For Daily Production:
- **Trigger**: `0 6 * * *` (6 AM daily)
- **daysBack**: `1` (today only)
- **Focus**: Fresh ideas from yesterday/today

### For Testing:
- **Trigger**: Manual
- **daysBack**: Variable (1, 7, 30)
- **Focus**: Specific scenarios

### For Weekly Batch:
- **Trigger**: `0 7 * * 1` (Monday 7 AM)
- **daysBack**: `7` (full week)
- **Focus**: Weekly processing cycle

## 🎛️ Quick Configuration Changes

**To test 1 day only:**
1. Set Director prompt to mention `daysBack=1`
2. Change system message to focus on daily processing
3. Run manually to test

**To test current setup:**
1. Keep `daysBack=7`
2. Run manually
3. Observe duplicate processing behavior

**To fix for production:**
1. Implement Daily Mode configuration
2. Change to `daysBack=1`
3. Schedule for daily execution 