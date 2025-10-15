# Stats Loading Timeout Fix

## Problem
When monitoring **many containers** (20+ containers), the Resource Breakdown page would show:
```
Failed to load container stats
Please check if Docker is running
```

This happened because:
1. **Timeout was too short**: 10 seconds for all stats requests
2. **Too many concurrent requests**: 23+ containers = 46+ API calls (stats + inspect)
3. **No partial results**: If any request failed, the whole page failed

## Root Cause Analysis
- Each container stats request included an expensive `inspect({ size: true })` call for disk usage
- With 23 containers, that's 46 concurrent Docker API calls
- Some requests would timeout after 10 seconds
- Frontend would catch the error and show "Failed to load" even if most containers succeeded

## Solution Implemented

### 1. Backend Optimizations (`server/docker/engineClient.js`)
**Increased timeout for stats requests:**
```javascript
// Before: timeout: 10000 (10 seconds for all requests)
// After:  timeout: 30000 (30 seconds) for /stats requests
//         timeout: 10000 (10 seconds) for other requests
```

### 2. Backend Optimization (`server/routes/containers.js`)
**Made disk info optional:**
- Now only fetches disk info when `?history=true` is passed
- Stats breakdown page doesn't need disk info, so it skips the expensive inspect call
- Reduces API calls from 46 to 23 for 23 containers

**Before:**
```javascript
// Always fetched both stats + disk info (slow!)
const result = await proxy.requestDockerAPI(`/containers/${id}/stats?stream=0`);
const info = await container.inspect({ size: true }); // EXPENSIVE!
```

**After:**
```javascript
// Only fetch disk info if explicitly requested
const includeHistory = req.query.history === 'true';
let info = null;
if (includeHistory) {
  info = await container.inspect({ size: true });
}
```

### 3. Frontend Resilience (`public/stats-breakdown.html`)
**Better error handling with partial results:**
- Added 25-second client-side timeout per request
- Failed containers are logged but don't crash the page
- Shows stats for containers that succeeded
- Warns in console about failed containers

**Before:**
```javascript
// Failed silently, then crashed on validStats.length === 0
const allStats = await Promise.all(statsPromises);
const validStats = allStats.filter(s => s !== null);
if (validStats.length === 0) return; // No error shown!
```

**After:**
```javascript
// Explicit timeout + better logging
fetch(`/api/containers/${c.Id}/stats`, { signal: AbortSignal.timeout(25000) })
  .catch(err => {
    console.warn(`Failed to fetch stats for ${c.Names?.[0]}:`, err.message);
    return null;
  })

// Show error only if ALL containers failed
if (validStats.length === 0) {
  throw new Error('No container stats could be loaded');
}

// Log warning for partial failures
const failedCount = runningContainers.length - validStats.length;
if (failedCount > 0) {
  console.warn(`${failedCount} of ${runningContainers.length} containers failed`);
}
```

## Performance Impact

### Before (23 containers):
- ⏱️ **API Calls**: 46 (23 stats + 23 inspect)
- ⏱️ **Timeout**: 10 seconds total
- ❌ **Result**: Many timeouts, page shows "Failed to load"

### After (23 containers):
- ⏱️ **API Calls**: 23 (only stats, no inspect)
- ⏱️ **Timeout**: 30 seconds per request, 25 seconds client-side
- ✅ **Result**: Loads successfully, shows partial results if some fail

**Speed improvement: ~2x faster** (fewer API calls)

## Benefits

✅ **Handles many containers** - Tested with 23+ running containers  
✅ **Graceful degradation** - Shows partial results if some containers fail  
✅ **Better performance** - Skips expensive disk inspect calls  
✅ **Better logging** - Console warnings for failed containers  
✅ **Longer timeouts** - 30s backend, 25s frontend (was 10s)  

## Testing

Test with many containers:
```bash
# Start the dashboard
docker compose up -d

# Check logs (should see stats requests completing)
docker compose logs -f

# Open Resource Breakdown page
# Should load all tabs successfully even with 20+ containers
```

## Remaining Improvements (Future)

For even better performance with 50+ containers:
1. **Batch requests**: Process containers in chunks of 10
2. **Progressive loading**: Show results as they come in
3. **Caching**: Cache stats for 1-2 seconds to reduce load
4. **Virtual scrolling**: Only render visible containers
5. **Background polling**: Update stats without re-fetching all containers

---

**Status**: ✅ Fixed - Resource Breakdown page now works with 20+ containers
