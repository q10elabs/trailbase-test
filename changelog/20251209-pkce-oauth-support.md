# PKCE OAuth Support in Test Client

## Task Specification

Add PKCE (Proof Key for Code Exchange) support to the test client's OAuth authentication flow. This should be implemented without modifying the TypeScript SDK, using raw API calls and the SDK's existing token initialization capabilities.

## High-Level Decisions

1. **PKCE Implementation**: Generate PKCE verifier/challenge pairs using Web Crypto API
2. **Storage**: Use `sessionStorage` with a single storage key to persist PKCE verifier during OAuth redirect flow (only one OAuth flow can be active at a time)
3. **Token Exchange**: Make direct API call to `/api/auth/v1/token` endpoint to exchange authorization code + verifier for tokens
4. **Client Initialization**: Use SDK's `initClient(site, { tokens })` to initialize client with tokens after successful exchange
5. **Backward Compatibility**: Keep existing cookie-based OAuth flow as fallback for non-PKCE scenarios

## Requirements Changes

- Initially: OAuth flow relied on server setting cookies, no PKCE support
- Updated: OAuth flow now uses PKCE with explicit code exchange for tokens

## Files Modified

- `client/src/pkce.ts` (new): PKCE utility functions for generating verifier/challenge pairs
- `client/src/auth.ts`: Updated `handleOAuth` to generate and include PKCE parameters, added `exchangeAuthCodeForTokens` function
- `client/src/app.ts`: Updated `checkOAuthCallback` to properly exchange authorization code for tokens using PKCE

## Rationales and Alternatives

**Why sessionStorage?**
- PKCE verifier must persist across redirect but only for the current session
- `sessionStorage` is cleared when tab closes, providing security
- Alternative `localStorage` would persist longer but isn't necessary

**Why single storage key (not provider-specific)?**
- PKCE verifier is between client and TrailBase, not per OAuth provider
- Only one OAuth flow can be active at a time (user is redirected away)
- Simpler implementation without unnecessary complexity

**Why direct API calls instead of SDK methods?**
- SDK doesn't expose PKCE or token exchange methods
- Direct API calls give full control over the flow
- SDK's `initClient` with tokens allows seamless integration after exchange

**Why keep cookie-based flow?**
- Some OAuth providers might not support PKCE
- Provides fallback mechanism
- Server may set cookies even in PKCE flow (dual support)

## Obstacles and Solutions

- **Challenge**: Web Crypto API requires async operations - Solution: Made PKCE generation async
- **Challenge**: Verifier must survive redirect - Solution: Store in sessionStorage with single storage key (only one OAuth flow active at a time)
- **Challenge**: Token exchange response format - Solution: Used existing `TokenResponse` type from server bindings
- **Challenge**: Initial implementation used provider-specific storage - Solution: Simplified to single storage key since PKCE is between client and TrailBase, not per provider

## Current Status

✅ PKCE utility functions implemented (`client/src/pkce.ts`)
✅ OAuth handler updated with PKCE generation (`handleOAuth` in `auth.ts`)
✅ Authorization code exchange implemented (`exchangeAuthCodeForTokens` in `auth.ts`)
✅ Client initialization with tokens working (`initializeClientWithTokens` in `auth.ts`)
✅ Callback handling updated (`checkOAuthCallback` in `app.ts`)
✅ All changes implemented without modifying TypeScript SDK

## Implementation Details

### PKCE Flow
1. User clicks OAuth button → `handleOAuth(provider)` called
2. Generate PKCE verifier/challenge pair using Web Crypto API
3. Store verifier in `sessionStorage` with provider-specific key
4. Redirect to OAuth login with `response_type=code`, `pkce_code_challenge`, and `redirect_uri`
5. OAuth provider redirects back with authorization code
6. `checkOAuthCallback()` extracts code from URL
7. Retrieve PKCE verifier from `sessionStorage`
8. Exchange code + verifier for tokens via `/api/auth/v1/token`
9. Initialize client with tokens using `initClient(site, { tokens })`
10. Clear verifier from storage and show authenticated UI

### Fallback Behavior
- If PKCE verifier not found in storage, falls back to cookie-based flow
- This supports scenarios where OAuth was initiated without PKCE or storage was cleared
