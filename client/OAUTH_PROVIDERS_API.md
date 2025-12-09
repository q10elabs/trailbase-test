# OAuth Providers API

## Overview

Trailbase provides an API endpoint to list the OAuth methods currently configured on the server. This document describes how to use this endpoint, particularly with the TypeScript client SDK.

## API Endpoint

**Path:** `GET /api/auth/v1/oauth/providers`

**Description:** Returns a list of OAuth providers that are currently configured and available for authentication.

**Authentication:** Not required (public endpoint)

**Response Format:**
```json
{
  "providers": [
    ["provider_name", "Display Name"],
    ["google", "Google"],
    ["discord", "Discord"]
  ]
}
```

The `providers` field is an array of tuples, where each tuple contains:
- `[0]`: Provider name (e.g., "google", "discord")
- `[1]`: Display name (e.g., "Google", "Discord")

## TypeScript Client SDK

### Current Status

The TypeScript client SDK does **not** expose a dedicated method for listing OAuth providers. However, you can use the generic `fetch()` method available on the `Client` interface to call this endpoint.

### Usage Example

```typescript
import { initClient } from 'trailbase';
import type { ConfiguredOAuthProvidersResponse } from '@bindings/ConfiguredOAuthProvidersResponse';

// Initialize the client
const client = initClient('http://localhost:7000');

// Fetch configured OAuth providers
async function getOAuthProviders(): Promise<ConfiguredOAuthProvidersResponse> {
  const response = await client.fetch('/api/auth/v1/oauth/providers');
  return await response.json();
}

// Usage
const providers = await getOAuthProviders();
console.log(providers.providers);
// Output: [["google", "Google"], ["discord", "Discord"]]

// Iterate over providers
for (const [name, displayName] of providers.providers) {
  console.log(`${displayName} (${name})`);
}
```

### Type Definitions

The TypeScript type `ConfiguredOAuthProvidersResponse` is automatically generated from the Rust backend and is available in the bindings:

```typescript
export type ConfiguredOAuthProvidersResponse = { 
  /**
   * List of tuples (<name>, <display_name>).
   */
  providers: Array<[string, string]>;
};
```

This type is located at: `trailbase/crates/assets/js/bindings/ConfiguredOAuthProvidersResponse.ts`

### Complete Example: Dynamic OAuth Button Generation

Here's a complete example that fetches available OAuth providers and dynamically creates login buttons:

```typescript
import { initClient } from 'trailbase';
import type { ConfiguredOAuthProvidersResponse } from '@bindings/ConfiguredOAuthProvidersResponse';

const client = initClient('http://localhost:7000');

async function renderOAuthButtons() {
  try {
    const response = await client.fetch('/api/auth/v1/oauth/providers');
    const data: ConfiguredOAuthProvidersResponse = await response.json();
    
    const container = document.getElementById('oauth-buttons');
    if (!container) return;
    
    // Clear existing buttons
    container.innerHTML = '';
    
    // Create a button for each provider
    for (const [name, displayName] of data.providers) {
      const button = document.createElement('button');
      button.textContent = `Login with ${displayName}`;
      button.onclick = () => handleOAuthLogin(name);
      container.appendChild(button);
    }
  } catch (error) {
    console.error('Failed to fetch OAuth providers:', error);
  }
}

function handleOAuthLogin(provider: string) {
  // Redirect to OAuth login endpoint
  const redirectUri = window.location.origin + window.location.pathname;
  window.location.href = `/api/auth/v1/oauth/${provider}/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

// Call on page load
renderOAuthButtons();
```

## Related Endpoints

### Admin Endpoint (All Possible Providers)

There is also an admin endpoint that lists **all possible** OAuth providers (not just configured ones):

**Path:** `GET /api/admin/v1/oauth_providers`

**Authentication:** Required (admin access)

**Response Format:**
```json
{
  "providers": [
    {
      "id": 1,
      "name": "google",
      "display_name": "Google"
    },
    {
      "id": 2,
      "name": "discord",
      "display_name": "Discord"
    }
  ]
}
```

This endpoint is intended for administrative purposes (e.g., configuring which providers to enable) and is not part of the public client SDK.

## Implementation Details

- **Backend Handler:** `trailbase/crates/core/src/auth/oauth/list_providers.rs`
- **Route Registration:** `trailbase/crates/core/src/auth/oauth/mod.rs`
- **Response Type:** `ConfiguredOAuthProvidersResponse` (Rust) / `ConfiguredOAuthProvidersResponse` (TypeScript)

## Notes

- The endpoint only returns providers that are **currently configured** with valid client IDs and secrets
- The endpoint does not require authentication, making it suitable for public client applications
- The response format uses tuples `[string, string]` rather than objects, which is more compact but requires array destructuring when iterating
