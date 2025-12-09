# Implementing PKCE in a Trailbase TypeScript Client

This guide explains how to implement PKCE (Proof Key for Code Exchange) authentication in a Trailbase client application from first principles.

## What is PKCE?

PKCE (RFC 7636) is a security extension for OAuth 2.0 that protects against authorization code interception attacks. It's especially important for:

- **Native mobile/desktop apps** that can't securely store client secrets
- **Single-page applications (SPAs)** that run in browsers
- **Cross-origin scenarios** where cookies may not work reliably

PKCE works by having the client generate a random secret (the "verifier") and send a hashed version (the "challenge") to the server. Later, the client proves it knows the original secret by sending the verifier, which the server can verify by hashing it and comparing to the stored challenge.

## Trailbase PKCE Flow

Trailbase supports PKCE through a two-step authentication code flow:

1. **Login Step**: Client sends credentials + PKCE challenge → Server returns authorization code
2. **Token Exchange Step**: Client sends authorization code + PKCE verifier → Server returns tokens

For OAuth flows, the process is:
1. Client generates PKCE verifier/challenge
2. Client redirects to Trailbase OAuth endpoint with challenge
3. Trailbase redirects to OAuth provider (Google, Discord, etc.)
4. OAuth provider redirects back to Trailbase with OAuth code
5. Trailbase exchanges OAuth code for tokens (using Trailbase's own PKCE with provider)
6. Trailbase redirects back to client with authorization code
7. Client exchanges authorization code + PKCE verifier for tokens

## Implementation Guide

### Step 1: Generate PKCE Verifier and Challenge

The PKCE verifier is a cryptographically random string, and the challenge is its SHA-256 hash, base64url-encoded.

```typescript
/**
 * Generates a PKCE code verifier and challenge pair.
 * 
 * The verifier is a cryptographically random string (43-128 characters).
 * The challenge is the base64url-encoded SHA256 hash of the verifier.
 * 
 * @param length - Length of random bytes to generate (32-96, default 32)
 * @returns Promise resolving to PKCE pair with verifier and challenge
 */
async function generatePkcePair(length: number = 32): Promise<{ verifier: string; challenge: string }> {
  if (length < 32 || length > 96) {
    throw new Error('PKCE verifier length must be between 32 and 96 bytes');
  }

  // Generate random verifier bytes
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  // Encode verifier as base64url (no padding)
  // Base64url uses - and _ instead of + and /, and removes padding =
  const verifier = base64UrlEncode(randomBytes).replace(/=/g, '');

  // Compute SHA256 hash of verifier
  const encoder = new TextEncoder();
  const verifierBytes = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', verifierBytes);

  // Encode challenge as base64url (no padding)
  const challenge = base64UrlEncode(new Uint8Array(hashBuffer)).replace(/=/g, '');

  return { verifier, challenge };
}

/**
 * Encode bytes as base64url string.
 * Base64url uses - and _ instead of + and /, and removes padding =.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  // Convert to regular base64
  const base64 = btoa(String.fromCharCode(...bytes));
  // Convert to base64url: replace + with -, / with _, and remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
```

**Key Points:**
- Use `crypto.getRandomValues()` for cryptographically secure random bytes
- Verifier length should be 32-96 bytes (RFC 7636 recommendation: 32 bytes)
- Base64url encoding uses `-` and `_` instead of `+` and `/`, and removes padding `=`
- Challenge is always SHA-256 hash of the verifier (base64url-encoded)

### Step 2: Store Verifier for Later Use

The verifier must be stored securely and retrieved after the OAuth redirect. Since only one OAuth flow can be active at a time, use a single storage key.

```typescript
const PKCE_STORAGE_KEY = 'trailbase_pkce_verifier';

function storePkceVerifier(verifier: string): void {
  try {
    sessionStorage.setItem(PKCE_STORAGE_KEY, verifier);
  } catch {
    // Ignore errors (e.g., in private browsing mode)
  }
}

function getPkceVerifier(): string | null {
  try {
    return sessionStorage.getItem(PKCE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearPkceVerifier(): void {
  try {
    sessionStorage.removeItem(PKCE_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
```

**Why sessionStorage?**
- Persists across page redirects (unlike memory)
- Cleared when tab closes (better security than localStorage)
- Only accessible to same origin (prevents XSS attacks from other sites)

### Step 3: Initiate OAuth Login with PKCE

When the user clicks an OAuth login button, generate PKCE and include it in the redirect URL.

```typescript
async function handleOAuthLogin(provider: string) {
  try {
    // Generate PKCE verifier and challenge
    const { verifier, challenge } = await generatePkcePair();
    
    // Store verifier for later retrieval after redirect
    storePkceVerifier(verifier);
    
    // Build OAuth login URL with PKCE parameters
    const redirectUri = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      response_type: 'code',  // Request authorization code (not tokens directly)
      pkce_code_challenge: challenge,
    });
    
    // Redirect to Trailbase OAuth login endpoint
    const trailbaseUrl = 'http://localhost:7000'; // Your Trailbase server URL
    window.location.href = `${trailbaseUrl}/api/auth/v1/oauth/${provider}/login?${params.toString()}`;
  } catch (err) {
    console.error('Failed to initiate OAuth flow:', err);
    // Show error to user
  }
}
```

**Required Parameters:**
- `redirect_uri`: Where Trailbase should redirect after OAuth completes
- `response_type=code`: Request authorization code (required for PKCE flow)
- `pkce_code_challenge`: The base64url-encoded SHA-256 hash of the verifier

### Step 4: Handle OAuth Callback

After OAuth completes, Trailbase redirects back to your app with an authorization code in the URL query string.

```typescript
async function handleOAuthCallback(): Promise<boolean> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (!code) {
    return false; // No OAuth callback
  }
  
  // Retrieve the PKCE verifier we stored earlier
  const pkceVerifier = getPkceVerifier();
  
  if (!pkceVerifier) {
    console.error('PKCE verifier not found - OAuth flow may have failed');
    // Fall back to cookie-based flow if available
    return false;
  }
  
  // Exchange authorization code + verifier for tokens
  const tokens = await exchangeAuthCodeForTokens(code, pkceVerifier);
  
  if (tokens) {
    // Clear the verifier (no longer needed)
    clearPkceVerifier();
    
    // Initialize your Trailbase client with the tokens
    initializeClientWithTokens(tokens);
    
    // Clean up URL by removing the code parameter
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    
    return true; // Successfully handled OAuth callback
  }
  
  return false; // Token exchange failed
}
```

### Step 5: Exchange Authorization Code for Tokens

Call Trailbase's token endpoint with the authorization code and PKCE verifier.

```typescript
interface Tokens {
  auth_token: string;
  refresh_token: string | null;
  csrf_token: string | null;
}

async function exchangeAuthCodeForTokens(
  authorizationCode: string,
  pkceVerifier: string
): Promise<Tokens | null> {
  try {
    const trailbaseUrl = 'http://localhost:7000'; // Your Trailbase server URL
    
    const response = await fetch(`${trailbaseUrl}/api/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code: authorizationCode,
        pkce_code_verifier: pkceVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', response.status, errorText);
      return null;
    }

    const tokens: Tokens = await response.json();
    return tokens;
  } catch (err) {
    console.error('Error exchanging authorization code for tokens:', err);
    return null;
  }
}
```

**What Happens Server-Side:**
1. Trailbase receives the authorization code and PKCE verifier
2. Trailbase computes SHA-256 hash of the verifier (base64url-encoded)
3. Trailbase compares the computed challenge to the stored challenge
4. If they match, Trailbase issues tokens (auth_token, refresh_token, csrf_token)
5. If they don't match, Trailbase returns an error

### Step 6: Initialize Client with Tokens

Use Trailbase SDK's `initClient` function to create an authenticated client.

```typescript
import { initClient, type Tokens } from 'trailbase';

function initializeClientWithTokens(tokens: Tokens) {
  const trailbaseUrl = 'http://localhost:7000';
  
  const client = initClient(trailbaseUrl, {
    tokens,
    onAuthChange: (client, user) => {
      if (!user) {
        // User was logged out (e.g., refresh failed)
        // Handle logout in your app
      }
    },
  });
  
  // Store client instance for use throughout your app
  // client.user() will now return the authenticated user
  // client.fetch() will include authentication headers
}
```

## Complete Example

Here's a complete example putting it all together:

```typescript
import { initClient, type Tokens } from 'trailbase';

const TRAILBASE_URL = 'http://localhost:7000';
const PKCE_STORAGE_KEY = 'trailbase_pkce_verifier';

// PKCE generation
async function generatePkcePair(length: number = 32) {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  const verifier = base64UrlEncode(randomBytes).replace(/=/g, '');
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(hashBuffer)).replace(/=/g, '');
  return { verifier, challenge };
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Storage helpers
function storePkceVerifier(verifier: string) {
  sessionStorage.setItem(PKCE_STORAGE_KEY, verifier);
}

function getPkceVerifier(): string | null {
  return sessionStorage.getItem(PKCE_STORAGE_KEY);
}

function clearPkceVerifier() {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
}

// OAuth login
async function handleOAuthLogin(provider: string) {
  const { verifier, challenge } = await generatePkcePair();
  storePkceVerifier(verifier);
  
  const redirectUri = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    response_type: 'code',
    pkce_code_challenge: challenge,
  });
  
  window.location.href = `${TRAILBASE_URL}/api/auth/v1/oauth/${provider}/login?${params.toString()}`;
}

// Token exchange
async function exchangeAuthCodeForTokens(code: string, verifier: string): Promise<Tokens | null> {
  const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authorization_code: code,
      pkce_code_verifier: verifier,
    }),
  });
  
  return response.ok ? await response.json() : null;
}

// App initialization
async function init() {
  // Check for OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  if (code) {
    const verifier = getPkceVerifier();
    if (verifier) {
      const tokens = await exchangeAuthCodeForTokens(code, verifier);
      if (tokens) {
        clearPkceVerifier();
        const client = initClient(TRAILBASE_URL, { tokens });
        // Use authenticated client...
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
    }
  }
  
  // Normal initialization (check cookies, etc.)
  const client = await initClientFromCookies(TRAILBASE_URL);
  // Use client...
}

// OAuth button handler
document.getElementById('oauth-google-btn')?.addEventListener('click', () => {
  handleOAuthLogin('google');
});
```

## Security Considerations

1. **Verifier Storage**: Use `sessionStorage` (not `localStorage`) so verifiers are cleared when the tab closes
2. **Verifier Length**: Use at least 32 bytes (43 characters when base64url-encoded) for sufficient entropy
3. **HTTPS**: Always use HTTPS in production to protect the verifier during transmission
4. **Verifier Cleanup**: Always clear the verifier from storage after successful token exchange or on error
5. **Error Handling**: If token exchange fails, clear the verifier and prompt user to try again

## Troubleshooting

**"PKCE verifier not found" error:**
- User may have cleared sessionStorage or opened in a new tab
- Fall back to cookie-based authentication if available
- Prompt user to try logging in again

**"Invalid PKCE challenge" error:**
- Ensure challenge is base64url-encoded (not regular base64)
- Ensure padding (`=`) is removed from both verifier and challenge
- Verify SHA-256 hash is computed correctly

**Token exchange fails:**
- Verify authorization code hasn't expired (typically 5 minutes)
- Ensure verifier matches the one used to generate the challenge
- Check that `response_type=code` was included in the login request

## Additional Resources

- [RFC 7636: Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [Trailbase Authentication Documentation](https://trailbase.io/docs/auth)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
