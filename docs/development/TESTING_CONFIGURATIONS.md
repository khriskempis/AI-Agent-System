# Testing Configuration Guide

## ✅ **Current Status: Fixed for Daily Processing**

The workflow has been updated to process **today's ideas only** (`daysBack=1`) to avoid duplicate processing and align with the daily trigger.

## 🧪 **Testing Different Time Ranges**

### 1. Test Current Configuration (Today Only)
**Current Setup**: `daysBack=1` (today's ideas only)

**To Test:**
1. **Manual Execution**: Click "Test workflow" in n8n
2. **Expected Behavior**: Processes only ideas created/modified today
3. **Verification**: Check that only today's "Not Started" ideas are processed

### 2. Test 1 Day Only (Current Default)
**No changes needed** - this is now the default configuration.

### 3. Test This Week (7 Days)
**To temporarily test weekly processing:**

**Option A: Quick Manual Test**
1. **Change Director Prompt** temporarily:
   ```
   "Focus on unprocessed ideas from this week. Check for 'Not Started' status ideas from the last 7 days (daysBack=7), process them efficiently, and confirm completion."
   ```

2. **Change System Message** temporarily:
   ```
   - **Priority**: Focus on 'Not Started' ideas from last 7 days (daysBack=7)
   - get_ideas: Retrieve ideas with status and date filtering (status='Not Started', daysBack=7)
   ```

3. **Run Manual Test**
4. **Revert Changes** after testing

**Option B: Create Test Workflow Copy**
1. **Export** current workflow
2. **Import** as "Weekly Test Version"
3. **Modify** the copy for `daysBack=7`
4. **Test** the weekly version
5. **Keep Both** for different scenarios

### 4. Test Custom Date Range
**For testing specific scenarios:**

**Create Manual Test Workflow:**
1. **Replace Cron Trigger** with Manual Trigger
2. **Add Parameter Input Node**:
   ```json
   {
     "parameters": {
       "assignments": {
         "assignments": [
           {
             "name": "testDaysBack",
             "value": "1",
             "type": "number"
           }
         ]
       }
     }
   }
   ```

3. **Dynamic Director Prompt**:
   ```
   "Focus on unprocessed ideas from the last {{ $('Test Parameters').item.json.testDaysBack }} day(s). Process efficiently and confirm completion."
   ```

## ⚙️ **Quick Testing Commands**

### Test Today Only (Current):
```
Manual execution → Processes daysBack=1
```

### Test This Week:
```
1. Change prompt to mention "daysBack=7"
2. Manual execution
3. Revert changes
```

### Test Specific Range:
```
1. Create parameter node with custom daysBack value
2. Reference in Director prompt
3. Manual execution with different values
```

## 🔄 **Configuration Switching**

### Development/Testing Mode:
- **Trigger**: Manual
- **Scope**: Variable (`daysBack=1,7,30`)
- **Purpose**: Testing different scenarios

### Production Daily Mode (Current):
- **Trigger**: Daily at 9 AM
- **Scope**: Today only (`daysBack=1`)
- **Purpose**: Daily fresh idea processing

### Production Weekly Mode:
- **Trigger**: Weekly (Mondays)
- **Scope**: Past week (`daysBack=7`)
- **Purpose**: Weekly batch processing

## 📊 **Testing Scenarios**

### Scenario 1: Empty Day
- **Setup**: No ideas created today
- **Expected**: "No unprocessed ideas found for today"
- **Test**: Manual execution on quiet day

### Scenario 2: Single Idea Day
- **Setup**: One new idea created today
- **Expected**: Process single idea → status "Done"
- **Test**: Create test idea, run workflow

### Scenario 3: Multiple Ideas Day
- **Setup**: Several new ideas created today
- **Expected**: Process all → detect multi-ideas → categorize
- **Test**: Create multiple test ideas, run workflow

### Scenario 4: Mixed Status Day
- **Setup**: Mix of "Not Started", "In Progress", "Done" ideas from today
- **Expected**: Only process "Not Started" ideas
- **Test**: Create ideas with different statuses, run workflow

## 🎛️ **How to Modify for Testing**

### Quick 1-Day Test (Current Default):
✅ **No changes needed** - this is now the default

### Quick 7-Day Test:
1. **Find Director Agent** (node ID "5")
2. **Change prompt** text to mention `daysBack=7`
3. **Change system message** to reference 7 days
4. **Run manual test**
5. **Revert changes**

### Custom Range Test:
1. **Add Set node** before Director with `testDays` parameter
2. **Update Director prompt** to use `{{ $('Set Test Parameters').item.json.testDays }}`
3. **Test with different values**

## 🚨 **Important Notes**

### For Daily Production:
- **Keep `daysBack=1`** to avoid reprocessing
- **Use daily trigger** (9 AM)
- **Monitor for duplicate processing**

### For Testing:
- **Use manual trigger** to control execution
- **Test with real data** to verify behavior
- **Always revert changes** after testing

### For Weekly Processing:
- **Change trigger** to weekly (Monday mornings)
- **Use `daysBack=7`** for full week scope
- **Consider overlap** with daily processing

## ✨ **Ready to Test**

The workflow is now configured for **daily processing** (`daysBack=1`). You can:

1. **Test immediately**: Run manual execution to see today's processing
2. **Modify for weekly**: Temporarily change to `daysBack=7` for testing
3. **Create test versions**: Export/import for different configurations
4. **Monitor results**: Check idea status changes and processing behavior 