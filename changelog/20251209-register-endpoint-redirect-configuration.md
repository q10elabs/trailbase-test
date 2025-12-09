# Register Endpoint Redirect Configuration

## Task Specification

The Trailbase register endpoint (`/api/auth/v1/register`) currently returns a 303 redirect to `/_/auth/login` with an alert query parameter. However, the client app does not implement this route, causing issues when the browser automatically follows the redirect.

**User Request**: Determine if the redirect URL is configurable in Trailbase, or identify alternative options.

## Current State Analysis

### Trailbase Register Endpoint Behavior

- **Location**: `trailbase/crates/core/src/auth/api/register.rs`
- **Current Implementation**:
  - Only accepts `Form` data (not JSON)
  - Always returns 303 redirects (never JSON responses)
  - Hardcoded redirect URLs:
    - On error: `/_/auth/register?alert={msg}`
    - On success: `/_/auth/login?alert={msg}`
  - Does NOT accept a `redirect_uri` parameter

### Comparison with Login Endpoint

The login endpoint (`/api/auth/v1/login`) has more flexibility:
- Accepts both JSON and Form data
- Returns JSON when JSON is sent, redirects when Form is sent
- Accepts `redirect_uri` parameter in the request
- Uses `Either<LoginRequest>` to handle both content types

### Client Implementation

- **Location**: `client/src/auth.ts` (`handleSignup` function)
- Currently sends Form data and expects to handle the response directly
- Does not implement `/_/auth/login` route
- Browser automatically follows 303 redirects, causing navigation to non-existent route

## Options Identified

1. **Modify Trailbase** to add JSON support and `redirect_uri` parameter (similar to login endpoint)
2. **Client-side workaround**: Prevent redirect following using `fetch` with `redirect: 'manual'`
3. **Implement the route**: Add `/_/auth/login` handler in client app (workaround)
4. **Use Accept header**: Check if Trailbase respects Accept headers for content negotiation

## High-Level Decisions

*To be determined based on user preference*

## Requirements Changes

*None yet*

## Files Modified

- `client/REGISTER_ENDPOINT_REDIRECT.md` - Created comprehensive documentation explaining the problem, current behavior, and all available options with code examples

## Rationales and Alternatives

*To be filled in after implementation*

## Obstacles and Solutions

*To be filled in as encountered*

## Current Status

**Analysis complete** - Ready to present options to user and implement chosen solution.
