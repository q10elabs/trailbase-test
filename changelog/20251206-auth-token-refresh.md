# Auth Token Refresh and Sleep/Wake Handling

## Task Specification

The client application currently does not support refreshing authentication tokens, causing the application to lose access to the server after periods of inactivity. Additionally, when the computer wakes from sleep, if authentication state is fully lost and cannot be resumed through refresh, the app should redirect to the login screen.

Requirements:
1. Implement periodic token refresh to prevent expiration during inactivity
2. Handle sleep/wake scenarios - check auth status when app becomes visible
3. If refresh fails or auth is lost, redirect to login screen
4. Use the existing `client.refreshAuthToken()` API method

## High-Level Decisions

- **Periodic refresh interval**: Refresh tokens every 5 minutes (300 seconds) to proactively prevent expiration. Auth tokens expire after 60 minutes, so refreshing every 5 minutes ensures we refresh well before expiration (12 refreshes per token lifetime).
- **Page Visibility API**: Use `visibilitychange` event to detect when the page becomes visible (e.g., after computer wakes from sleep). When visible, check auth status and attempt token refresh.
- **Auth state monitoring**: Use client's `onAuthChange` callback to detect when user is logged out (e.g., refresh fails with 401). Automatically redirect to login when auth state is lost.
- **Error handling**: Gracefully handle refresh failures - if refresh fails or user is logged out, stop refresh interval and redirect to login screen.

## Requirements Changes

None.

## Files Modified

- `client/src/app.ts`: Added token refresh functionality
  - Added `refreshIntervalId` variable to track periodic refresh interval
  - Added `REFRESH_INTERVAL_MS` constant (5 minutes)
  - Added `attemptTokenRefresh()` function to safely attempt token refresh
  - Added `startTokenRefreshInterval()` and `stopTokenRefreshInterval()` functions
  - Added `handleVisibilityChange()` function for sleep/wake detection
  - Updated `init()` to set up `onAuthChange` callback and visibility listener
  - Updated `handleLogin()` to start refresh interval after successful login
  - Updated `handleLogout()` to stop refresh interval on logout

## Rationales and Alternatives

**Refresh interval timing**: 
- Chose 5 minutes based on best practices (refresh when <10% of lifetime remains)
- With 60-minute token TTL, 5-minute intervals provide 12 refreshes per token lifetime
- Alternative: Calculate refresh time based on token expiration (e.g., refresh when 10% of lifetime remains), but fixed interval is simpler and more predictable

**Visibility change handling**:
- Use Page Visibility API (`visibilitychange` event) rather than `focus`/`blur` events
- More reliable for detecting sleep/wake scenarios across different browsers
- Only check when page becomes visible (not when hidden) to avoid unnecessary checks

**Auth state monitoring**:
- Use `onAuthChange` callback provided by client library
- Automatically handles logout scenarios (e.g., refresh fails with 401)
- Alternative: Poll `client.user()` periodically, but callback is more efficient and immediate

## Obstacles and Solutions

- **Client initialization**: `initClientFromCookies` supports `onAuthChange` callback via `opts` parameter - used this to set up auth state monitoring
- **Refresh interval management**: Need to ensure interval is cleared on logout and when auth is lost - added `stopTokenRefreshInterval()` calls in appropriate places
- **Error handling**: Refresh can fail silently - added return value to `attemptTokenRefresh()` to detect failures and redirect to login

## Current Status

✅ Implementation complete. The application now:
- Refreshes auth tokens every 5 minutes during active sessions
- Detects when the page becomes visible (e.g., after sleep) and refreshes tokens
- Automatically redirects to login when auth state is lost
- Properly cleans up refresh intervals on logout
