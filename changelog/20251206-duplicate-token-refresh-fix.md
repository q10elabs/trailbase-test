# Duplicate Token Refresh Investigation

## Task Specification
User reported seeing duplicate token refresh calls in the browser console when clicking "increment counter":
- Two `/api/auth/v1/refresh` calls at the start
- Another refresh call before PATCH request
- Refresh calls happening even when tokens shouldn't be expired
- Logs showing "Set token state (expired)" messages

Expected behavior: Token refresh should only happen when the access token is actually about to expire, not on every request.

## Root Cause Analysis

### Primary Issue: Redundant Manual Refresh
**Location**: `client/src/counter.ts:52`

The code explicitly calls `await client.refreshAuthToken()` before making API calls with the comment "to prevent duplicate refresh requests" - but this actually CAUSES duplicate refreshes!

**Why this happens:**
1. Line 52: `client.refreshAuthToken()` checks `shouldRefresh()` and refreshes if token expires within 60 seconds
2. Line 58: `api.list()` internally calls `client.fetch()`, which ALSO checks `shouldRefresh()` and refreshes again
3. Line 73: `api.update()` internally calls `client.fetch()`, which would refresh a third time if needed

**The TrailBase SDK already handles token refresh automatically** in the `client.fetch()` method (see `trailbase/crates/assets/js/client/src/index.ts:802-809`).

### Secondary Issue: "Set token state (expired)" Messages
**Location**: `trailbase/crates/assets/js/client/src/index.ts:789-793`

After a successful refresh, the SDK logs "Set token state (expired)" which indicates the refreshed token is immediately considered expired. This could be due to:
- Server returning a token with incorrect expiration time
- Clock skew between client and server
- Token expiration window being too aggressive (60 second threshold)

## Files Involved
- `client/src/counter.ts` - Contains redundant refresh call
- `trailbase/crates/assets/js/client/src/index.ts` - TrailBase SDK with auto-refresh logic

## Solution

### Primary Fix
Remove the redundant `client.refreshAuthToken()` call from `counter.ts:52`. The SDK's `fetch()` method already handles refresh automatically before each request.

### Investigation Needed
Why tokens appear expired immediately after refresh (the "Set token state (expired)" issue) - this may need server-side investigation or adjustment to the 60-second refresh window.

## Current Status
- Initial fix applied (removed explicit refresh call)
- Issue persists - still seeing duplicate refreshes
- Investigating deeper: race condition in SDK

## Further Investigation

### User Reports
After removing the explicit `client.refreshAuthToken()` call, duplicate refreshes still occur. This indicates the problem is in the SDK itself, not the application code.

### Hypothesis: Race Condition in Token Refresh
Looking at `client.fetch()` in the SDK (lines 802-823), I notice a potential race condition:

1. First API call (`api.list()`) enters `fetch()`
   - Checks `shouldRefresh()` synchronously → returns refresh token
   - Starts `refreshTokensImpl()` (async operation, takes ~5ms)
2. Second API call (`api.update()`) enters `fetch()` before first refresh completes
   - Checks `shouldRefresh()` synchronously → STILL sees old expired token!
   - Starts SECOND `refreshTokensImpl()` (duplicate refresh!)

**The problem**: `shouldRefresh()` is synchronous but `refreshTokensImpl()` is async. The token state isn't updated until after the async refresh completes, so concurrent requests both see the old token and both trigger refreshes.

### Debugging Added
Added detailed console.debug logging to the TrailBase SDK (`trailbase/crates/assets/js/client/src/index.ts`):

1. `shouldRefresh()` - logs token expiration time and whether refresh will be triggered
2. `setTokenState()` - logs the new token's expiration time when set
3. `fetch()` - logs when fetch starts and when refresh is triggered

This will help us see:
- Exact token expiration times from the server
- Whether tokens are expired immediately after refresh
- The timing of refresh calls
- Whether multiple fetches trigger multiple refreshes

### Testing Plan
1. Reload the client app (http://localhost:5174/)
2. Login with test credentials
3. Click "increment counter"
4. Examine console output to see:
   - Token expiration times
   - Which fetch calls trigger refreshes
   - If refreshed tokens are already expired

## Resolution

### Actual Root Cause: Server Clock Skew
**The server's system time was 3 days behind the client.**

This caused the following behavior:
1. Server generates JWT tokens with expiration times (exp claim) based on its incorrect system time
2. Tokens appear to be "3 days in the past" from the client's perspective
3. Client's `shouldRefresh()` function compares token expiration against client system time
4. Every token appears expired immediately because `token.exp < Date.now()`
5. Client attempts to refresh on every API call, leading to duplicate refreshes

### Fix Applied
- Restarted ntpd service to synchronize server clock with NTP servers
- Server now has correct system time
- Tokens are generated with proper expiration times
- Duplicate refreshes no longer occur

### Files Modified
- `client/package.json` - Changed to use local SDK for debugging: `"trailbase": "file:../trailbase/crates/assets/js/client"`
- `trailbase/crates/assets/js/client/src/index.ts` - Added debug logging (can be reverted or kept for future debugging)

### Lessons Learned
1. Clock skew between client and server causes JWT token validation issues
2. The SDK's debug logging helped identify that tokens appeared expired immediately
3. Time synchronization (NTP) is critical for JWT-based authentication systems
4. The 60-second refresh window in `shouldRefresh()` is reasonable - the issue was not the threshold

## Final Status
✅ **Issue Resolved** - Server clock synchronized via ntpd restart
✅ **Debug instrumentation added** - Can be kept or removed as needed
✅ **Client configured for local SDK development** - Using file: dependency for debugging
