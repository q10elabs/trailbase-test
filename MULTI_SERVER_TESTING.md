# Multi-Server Testing Strategy for TrailBase

**Document Version**: 1.1
**Last Updated**: 2025-12-05
**Audience**: Development team and collaborators

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Industry Best Practices](#industry-best-practices)
4. [Solution Options](#solution-options)
5. [TrailBase Authentication APIs](#trailbase-authentication-apis)
6. [Recommended Implementation](#recommended-implementation)
7. [Implementation Examples](#implementation-examples)
8. [Migration Guide](#migration-guide)
9. [Troubleshooting](#troubleshooting)
10. [Appendices](#appendices)

---

## Executive Summary

### The Challenge

Supporting multiple TrailBase test servers running side-by-side on the same machine while maintaining OAuth authentication (Google) functionality. OAuth providers require fixed redirect URLs, creating a conflict with dynamic server instances.

### The Solution

**Hybrid Approach**: Use real OAuth for long-running development servers and programmatic authentication (via TrailBase's Admin API) for ephemeral test servers.

### Key Benefits

- ✅ No OAuth redirect URL limits
- ✅ Tests run in parallel without conflicts
- ✅ Fast and reliable (no external OAuth dependencies in tests)
- ✅ Each test suite fully isolated
- ✅ Matches industry best practices (Supabase, PocketBase patterns)

### Quick Start

For test environments, bypass OAuth entirely:

```typescript
// 1. Create test user
POST /api/_admin/user {email, password, verified: true}

// 2. Login to get token
POST /api/auth/v1/login {email, password}
→ Returns: {auth_token, refresh_token, csrf_token}

// 3. Use token in tests
Authorization: Bearer <auth_token>
```

---

## Problem Statement

### Context

This project uses TrailBase as a backend server with Google OAuth authentication. We need to support:

1. **Multiple developers** working on the same machine with independent server configurations
2. **Long-running servers** for frontend feature development
3. **Ephemeral servers** for backend API iteration and schema migrations
4. **Automated testing** with Playwright for full e2e flows
5. **Up to 10 concurrent users** plus automated test frameworks

### The OAuth Constraint

**Google OAuth Configuration** requires:
- **Fixed redirect URL** registered in Google Cloud Console
- Example: `http://localhost:7000/api/auth/v1/oauth/google/callback`

**TrailBase Configuration** validates:
- `site_url` in `config.textproto` must match the OAuth redirect domain
- Example: `site_url: "http://localhost:7000"`

**The Conflict**:
- Each TrailBase server needs a unique port (7000, 7001, 7002, ...)
- Each port requires a separate OAuth redirect URL registration
- Google OAuth apps have a **limit on redirect URLs** (~100)
- Managing 10+ developers × multiple servers = unsustainable

### Requirements

1. Isolated test environments (database, configuration, migrations)
2. Reproducible server state (hence the `run-fresh.sh` script)
3. Parallel test execution (CI/CD, local development)
4. Real authentication flows (not completely mocked)
5. Optional: Full OAuth e2e testing for authentication features

---

## Industry Best Practices

### What Other Tools Do

The challenge of "multiple test servers with OAuth" is **uncommon** in the industry. Here's how similar tools handle it:

#### PocketBase

**Typical Setup**:
- Developers run **one local instance** per machine on a fixed port
- Tests use **mock authentication** or pre-created test users
- Real OAuth testing done in **staging environments**

**Multi-Developer Scenarios**:
- Different ports + tunneling services (ngrok, localhost.run) for OAuth callbacks
- CI/CD uses ephemeral instances with test OAuth credentials

**Source**: [PocketBase Testing Practices](https://pocketbase.io/docs/)

#### Supabase

**Local Development**:
- `supabase start` creates Docker-based local environment
- Each developer has **one isolated Docker stack** per machine
- Tests **bypass OAuth** - they generate JWT tokens directly

**Real OAuth Testing**:
- Happens in **dedicated staging environments**, not locally
- Each developer gets their own cloud project for full integration testing

**Testing Pattern**:
```typescript
// Supabase test pattern
const { data, error } = await supabase.auth.admin.createUser({
  email: 'test@example.com',
  password: 'password',
  email_confirm: true  // Skip email verification
});
// Use the generated JWT directly in tests
```

**Source**: [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)

#### Common E2E Testing Patterns

| Test Type | Authentication Approach | OAuth Usage |
|-----------|------------------------|-------------|
| **Unit Tests** | Mock auth completely | ❌ No OAuth |
| **Integration Tests** | Pre-generated tokens | ❌ No OAuth |
| **E2E Tests (Playwright)** | Test users + real tokens | ❌ No OAuth |
| **OAuth E2E** | Staging environment OR mock service | ⚠️ Limited |

### Why Multiple Servers with Real OAuth is Rare

1. **OAuth Redirect Constraint**: Fixed URLs don't scale to many servers
2. **Complexity vs. Benefit**: Most bugs don't require full OAuth flow
3. **Test Reliability**: External OAuth adds flakiness and latency
4. **CI/CD Challenges**: Can't run parallel tests with real OAuth on same machine
5. **Security**: Test OAuth credentials shouldn't be in production OAuth apps

### Industry Consensus

**For Development**: One stable server with real OAuth per developer
**For Testing**: Programmatic auth tokens, no OAuth
**For OAuth Testing**: Dedicated staging environment or mock provider

---

## Solution Options

All options ranked by practicality for your specific requirements.

---

### Option 1: Hybrid Approach ⭐ (Recommended)

**Strategy**: Separate concerns between development and testing.

#### Architecture

```
Development (Long-running)
┌────────────────────────────────────────┐
│ Developer Machine                      │
│                                        │
│  ┌──────────────────┐                 │
│  │ TrailBase Server │ Port 7000       │
│  │  + Real OAuth    │ ←───────────┐   │
│  └──────────────────┘              │   │
│           ↑                         │   │
│           │ Proxy                   │   │
│  ┌──────────────────┐              │   │
│  │ Vite Dev Server  │ Port 5173    │   │
│  └──────────────────┘              │   │
│                                     │   │
│  Google OAuth:                      │   │
│  http://localhost:7000/oauth/callback  │
└────────────────────────────────────┴───┘

Testing (Ephemeral)
┌─────────────────────────────────────────┐
│ Test Suite A (Port 7001)                │
│  1. Create user via Admin API           │
│  2. Login to get JWT token              │
│  3. Run tests with token                │
│  ✓ No OAuth needed                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Test Suite B (Port 7002)                │
│  (Same pattern, fully isolated)         │
└─────────────────────────────────────────┘
```

#### Implementation

**For Development**:
- Each developer runs **one main server** on port 7000
- Configure real Google OAuth for `http://localhost:7000/api/auth/v1/oauth/google/callback`
- Frontend dev server (Vite) proxies API calls to this server
- Use for interactive feature development and manual testing

**For Testing**:
- Spin up ephemeral servers on random/sequential ports (7001-7999)
- Create test users via TrailBase Admin API
- Login programmatically to get JWT tokens
- Use tokens in Playwright/test code
- **No OAuth configuration needed**
- Each test suite gets isolated database via separate `DATA_DIR`

#### Advantages

✅ Solves OAuth redirect problem (only one stable URL needed)
✅ Tests are faster (no browser redirects to Google)
✅ Tests are more reliable (no external OAuth dependency)
✅ Supports unlimited parallel test execution
✅ Matches industry standard practice (Supabase, PocketBase)
✅ Each test suite fully isolated
✅ Works in CI/CD without additional setup

#### Disadvantages

⚠️ OAuth flow itself not tested in automated tests
⚠️ Requires implementing test helper utilities
⚠️ Developers need to understand two auth patterns

#### When to Use

- ✅ **Primary recommendation** for this project
- ✅ When you need parallel test execution
- ✅ When OAuth bugs are rare/not your main concern
- ✅ When test reliability and speed matter

#### Implementation Complexity

**Low to Medium** - Requires creating test helpers but TrailBase APIs make this straightforward.

---

### Option 2: Tunneling Service (ngrok, localhost.run)

**Strategy**: Use a tunneling service to expose different local ports with stable public URLs.

#### Architecture

```
┌────────────────────────────────────────┐
│ Developer 1                            │
│  TrailBase :7001 ──→ ngrok             │
│    https://abc123.ngrok.io             │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Developer 2                            │
│  TrailBase :7002 ──→ ngrok             │
│    https://def456.ngrok.io             │
└────────────────────────────────────────┘

Google OAuth Config:
  - https://abc123.ngrok.io/api/auth/v1/oauth/google/callback
  - https://def456.ngrok.io/api/auth/v1/oauth/google/callback
  - ... (up to ~100 URLs)
```

#### Implementation

```bash
# Developer 1
./run-fresh.sh /tmp/test1 --port 7001
ngrok http 7001  # Gets https://abc123.ngrok.io

# Developer 2
./run-fresh.sh /tmp/test2 --port 7002
ngrok http 7002  # Gets https://def456.ngrok.io
```

#### Advantages

✅ Real OAuth flows work for all servers
✅ Each developer/agent has isolated environment
✅ Simple conceptual model (just expose ports)

#### Disadvantages

❌ ngrok URLs change on restart (unless paid plan: $8-20/month per URL)
❌ Adds latency and external dependency
❌ Still limited by Google's redirect URL limit (~100)
❌ Requires internet connection for local development
❌ Security considerations (exposing local servers)
❌ Doesn't work in CI/CD without additional setup

#### When to Use

- ⚠️ When you specifically need to test OAuth flows for all developers
- ⚠️ When you have budget for ngrok paid plans
- ⚠️ For temporary/one-off OAuth testing scenarios

#### Implementation Complexity

**Low** - Just run ngrok and configure URLs, but ongoing management is tedious.

---

### Option 3: Reverse Proxy with Path-Based Routing

**Strategy**: Run a reverse proxy (nginx/Caddy) that routes based on path prefix, so all servers share one domain.

#### Architecture

```
┌─────────────────────────────────────────────┐
│ Reverse Proxy (localhost:8080)             │
│                                             │
│  /dev1/* ──→ TrailBase :7001               │
│  /dev2/* ──→ TrailBase :7002               │
│  /dev3/* ──→ TrailBase :7003               │
└─────────────────────────────────────────────┘

Google OAuth Config:
  Single URL: http://localhost:8080/dev1/api/auth/v1/oauth/google/callback
```

#### Implementation

**nginx configuration**:
```nginx
server {
  listen 8080;

  location /dev1/ {
    proxy_pass http://localhost:7001/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Prefix /dev1;
  }

  location /dev2/ {
    proxy_pass http://localhost:7002/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Prefix /dev2;
  }
}
```

#### Advantages

✅ One OAuth configuration for all servers
✅ Stable URLs that don't change
✅ No external dependencies

#### Disadvantages

❌ **Requires modifying TrailBase's OAuth callback handling**
   - TrailBase expects OAuth callbacks at root path `/api/auth/v1/oauth/...`
   - Would need to patch TrailBase to respect `X-Forwarded-Prefix`
❌ Complex setup and maintenance
❌ Might break TrailBase's URL assumptions elsewhere
❌ Developers must remember to use proxy URLs, not direct ports

#### When to Use

- ❌ **Not recommended** - Too complex and requires TrailBase modifications
- ⚠️ Only if you're willing to fork/patch TrailBase

#### Implementation Complexity

**High** - Requires nginx setup AND TrailBase source code modifications.

---

### Option 4: Shared OAuth + Database Isolation

**Strategy**: All developers share one TrailBase server with real OAuth, but use separate databases or schemas.

#### Architecture

```
┌────────────────────────────────────────┐
│ Shared TrailBase Server (Port 7000)   │
│  + Real OAuth                          │
│                                        │
│  ┌──────────┬──────────┬──────────┐   │
│  │  Schema  │  Schema  │  Schema  │   │
│  │   Dev1   │   Dev2   │   Dev3   │   │
│  └──────────┴──────────┴──────────┘   │
└────────────────────────────────────────┘
```

#### Implementation

Requires TrailBase to support multi-tenancy (schema-level or database-level isolation). Need to check if TrailBase supports this natively.

#### Advantages

✅ One OAuth setup
✅ Minimal configuration per developer

#### Disadvantages

❌ **Requires TrailBase multi-tenancy support** (needs verification)
❌ Developers can interfere with each other (server config, restarts)
❌ Can't test server configuration changes independently
❌ Can't test schema migrations in isolation
❌ Shared server = shared failure domain

#### When to Use

- ⚠️ Only if TrailBase supports multi-tenancy (needs investigation)
- ⚠️ Only for teams where server config changes are rare
- ❌ **Not recommended** for your use case (conflicts with schema migration testing)

#### Implementation Complexity

**Medium to High** - Depends on TrailBase's multi-tenancy capabilities (likely not available).

---

### Option 5: Mock OAuth Provider

**Strategy**: Run a local OAuth mock service that mimics Google's OAuth flow without external dependencies.

#### Architecture

```
┌─────────────────────────────────────────┐
│ Mock OAuth Server (Port 9000)          │
│  Mimics Google OAuth endpoints         │
│  /authorize, /token, /userinfo          │
└─────────────────────────────────────────┘
         ↑
         │ OAuth flow
         │
┌────────┴────────────────────────────────┐
│ TrailBase :7001 (configured to use     │
│ http://localhost:9000 as OAuth provider)│
└─────────────────────────────────────────┘
```

#### Implementation

**Tools**:
- [MockServer](https://www.mock-server.com/)
- [WireMock](http://wiremock.org/)
- Custom Node.js/Python server implementing OAuth2 protocol

**Example** (conceptual):
```typescript
// Mock OAuth server
app.get('/oauth/authorize', (req, res) => {
  // Return mock authorization code immediately
  res.redirect(`${req.query.redirect_uri}?code=MOCK_AUTH_CODE_123`);
});

app.post('/oauth/token', (req, res) => {
  // Return mock access token
  res.json({
    access_token: 'MOCK_ACCESS_TOKEN',
    token_type: 'Bearer',
    expires_in: 3600
  });
});
```

#### Advantages

✅ No external OAuth dependencies
✅ Fast and reliable
✅ Unlimited parallel servers
✅ Complete control over OAuth responses (can test error cases)

#### Disadvantages

❌ Doesn't test real Google OAuth (misses provider-specific bugs)
❌ Requires setup and maintenance of mock server
❌ Need to implement OAuth2 protocol correctly
❌ May drift from real OAuth behavior over time

#### When to Use

- ✅ For testing OAuth error handling and edge cases
- ✅ When you want to test OAuth flow but not the provider itself
- ⚠️ As a supplement to Option 1, not a replacement

#### Implementation Complexity

**Medium to High** - OAuth2 protocol is complex; easier to use existing mock tools.

---

## Solution Comparison Matrix

| Criterion | Option 1: Hybrid | Option 2: Tunneling | Option 3: Proxy | Option 4: Shared | Option 5: Mock OAuth |
|-----------|------------------|---------------------|-----------------|------------------|----------------------|
| **Setup Complexity** | Medium | Low | High | Medium-High | Medium-High |
| **Ongoing Maintenance** | Low | Medium | Medium | Low | Medium |
| **Parallel Testing** | ✅ Excellent | ⚠️ Limited | ✅ Good | ❌ No | ✅ Excellent |
| **Test Reliability** | ✅ Excellent | ⚠️ Depends on network | ✅ Good | ⚠️ Shared server | ✅ Excellent |
| **Test Speed** | ✅ Fast | ❌ Slow (latency) | ✅ Fast | ✅ Fast | ✅ Fast |
| **Real OAuth Testing** | ❌ No (dev only) | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Simulated |
| **OAuth URL Limits** | ✅ No issue | ❌ Still limited | ✅ No issue | ✅ No issue | ✅ No issue |
| **CI/CD Compatible** | ✅ Yes | ❌ Difficult | ⚠️ Requires setup | ⚠️ Depends | ✅ Yes |
| **Works Offline** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Industry Standard** | ✅ Yes | ⚠️ Sometimes | ❌ Rare | ❌ Rare | ⚠️ Sometimes |
| **Cost** | $0 | $0-240/year | $0 | $0 | $0 |
| **Recommended** | ✅ **PRIMARY** | ⚠️ Supplemental | ❌ No | ❌ No | ⚠️ Supplemental |

---

## TrailBase Authentication APIs

TrailBase provides comprehensive APIs for programmatic user and session management, making **Option 1 (Hybrid Approach)** fully feasible.

### Overview

TrailBase uses:
- **JWT tokens** for authentication (EdDSA/Ed25519 algorithm)
- **Refresh tokens** for session persistence (opaque, stored in `_session` table)
- **Admin API** for user management
- **Auth API** for login/token operations

All APIs are well-documented in the source code with test examples.

---

### Admin API: User Creation

Create users programmatically without email verification.

#### Endpoint

```
POST /api/_admin/user
Content-Type: application/json
Authorization: Bearer <admin_jwt_token>
CSRF-Token: <csrf_token_from_jwt>
```

**⚠️ Authentication Required**: This endpoint requires:
1. **Admin privileges**: User must have `admin = true` in `_user` table
2. **JWT token**: Valid authentication token in `Authorization` header
3. **CSRF token**: CSRF token from JWT claims in `CSRF-Token` header

To call this endpoint, first login as an admin user to get the required tokens.

#### Request

```json
{
  "email": "test@example.com",
  "password": "secure_password_123",
  "verified": true,   // ← Bypass email verification!
  "admin": false      // Whether user has admin privileges
}
```

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Key Features

- ✅ `verified: true` bypasses email verification (perfect for tests)
- ✅ Password is automatically hashed using Argon2
- ✅ Returns user UUID immediately
- ✅ Can create admin users by setting `admin: true`

#### Source Code Reference

**File**: `trailbase/crates/core/src/admin/user/create_user.rs`
**Lines**: 32-95

**Implementation Details**:
```rust
#[derive(Debug, Serialize, Deserialize, Default, TS)]
pub struct CreateUserRequest {
  pub email: String,
  pub password: String,
  pub verified: bool,
  pub admin: bool,
}

pub async fn create_user_handler(
  State(state): State<AppState>,
  Json(request): Json<CreateUserRequest>,
) -> Result<Json<CreateUserResponse>, Error>
```

**Test Helper** (lines 97-115):
```rust
#[cfg(test)]
pub(crate) async fn create_user_for_test(
  state: &AppState,
  email: &str,
  password: &str,
) -> Result<Uuid, Error>
```

#### Complete Usage Example

```bash
# Step 1: Login as admin to get tokens
curl -X POST http://localhost:7000/api/auth/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@localhost",
    "password": "your_admin_password"
  }'

# Response:
# {
#   "auth_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
#   "refresh_token": "abc123...",
#   "csrf_token": "xyz789..."
# }

# Step 2: Create test user using admin tokens
curl -X POST http://localhost:7000/api/_admin/user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc..." \
  -H "CSRF-Token: xyz789..." \
  -d '{
    "email": "test@example.com",
    "password": "test_password",
    "verified": true,
    "admin": false
  }'

# Response:
# {
#   "id": "550e8400-e29b-41d4-a716-446655440000"
# }
```

See the [Python Authentication Test Script](#python-authentication-test-script) section for a complete working implementation.

---

### Auth API: Login

Authenticate a user and receive JWT tokens.

#### Endpoint

```
POST /api/auth/v1/login
Content-Type: application/json
```

#### Request

```json
{
  "email": "test@example.com",
  "password": "secure_password_123"
}
```

#### Response

```json
{
  "auth_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ...",
  "refresh_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "csrf_token": "x1y2z3a4b5c6d7e8f9g0"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `auth_token` | String (JWT) | Short-lived access token (60 min default) |
| `refresh_token` | String (opaque) | Long-lived token for refreshing (30 days default) |
| `csrf_token` | String | CSRF protection token |

#### Token Usage

**HTTP Header** (recommended for APIs):
```http
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

**Cookie** (for web apps):
```http
Cookie: auth_token=eyJ0eXAiOiJKV1QiLCJhbGc...
```

#### Source Code Reference

**File**: `trailbase/crates/core/src/auth/api/login.rs`
**Lines**: 295-322

**Implementation**:
```rust
pub(crate) async fn login_with_password(
  state: &AppState,
  normalized_email: &str,
  password: &str,
  auth_token_ttl: Duration,
) -> Result<NewTokens, AuthError>
```

---

### JWT Token Structure

TrailBase uses **EdDSA (Ed25519)** for JWT signing.

#### Token Claims

```json
{
  "sub": "VVDoBOKbQdSnFkZlVEAAAQ==",  // Base64-encoded user UUID
  "iat": 1733404800,                   // Issued at (Unix timestamp)
  "exp": 1733408400,                   // Expires at (Unix timestamp)
  "email": "test@example.com",         // User's email
  "csrf_token": "x1y2z3a4b5c6d7e8f9g0" // Random CSRF token (20 chars)
}
```

#### Cryptographic Details

- **Algorithm**: EdDSA (Edwards-curve Digital Signature Algorithm)
- **Curve**: Ed25519 (256-bit elliptic curve)
- **Key Storage**: `<DATA_DIR>/keys/{private_key.pem, public_key.pem}`
- **Key Generation**: Automatic on first server start

#### Token Lifecycle

| Token Type | Default TTL | Storage | Purpose |
|------------|-------------|---------|---------|
| **Auth Token** | 60 minutes | JWT (stateless) | API authentication |
| **Refresh Token** | 30 days | `_session` table | Token renewal |

#### Source Code Reference

**File**: `trailbase/crates/core/src/auth/jwt.rs`
**Lines**: 31-65

**Claims Structure**:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TokenClaims {
  pub sub: String,        // URL-safe Base64 encoded user ID
  pub iat: i64,           // Issued at (Unix timestamp)
  pub exp: i64,           // Expiration timestamp
  pub email: String,      // User's email
  pub csrf_token: String, // Random CSRF token
}
```

**JWT Helper**:
```rust
pub struct JwtHelper {
  encoding_key: EncodingKey,    // EdDSA private key
  decoding_key: DecodingKey,    // EdDSA public key
}

impl JwtHelper {
  pub fn encode<T: Serialize>(&self, claims: &T) -> Result<String, JwtError>
  pub fn decode<T: DeserializeOwned>(&self, token: &str) -> Result<T, JwtError>
}
```

---

### Token Minting (Internal)

How TrailBase creates new sessions internally.

#### Source Code Reference

**File**: `trailbase/crates/core/src/auth/tokens.rs`
**Lines**: 161-194

#### Process

```rust
pub(crate) async fn mint_new_tokens(
  user_conn: &Connection,
  db_user: &DbUser,
  expires_in: Duration,
) -> Result<FreshTokens, AuthError> {
  // 1. Create token claims
  let claims = TokenClaims::new(
    db_user.verified(),
    db_user.id(),
    db_user.email.clone(),
    expires_in
  );

  // 2. Generate refresh token (32 random characters)
  let refresh_token = generate_random_string(REFRESH_TOKEN_LENGTH);

  // 3. Insert into _session table
  // INSERT INTO '_session' (user, refresh_token, updated)
  // VALUES (?, ?, ?)

  // 4. Return both tokens
  Ok(FreshTokens {
    auth_token_claims: claims,
    refresh_token,
  })
}
```

#### Database Tables

**`_user` table** (user accounts):
```sql
CREATE TABLE _user (
  id BLOB PRIMARY KEY,           -- UUID (16 bytes)
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,   -- Argon2 hash
  verified BOOLEAN NOT NULL,
  admin BOOLEAN NOT NULL,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  -- OAuth fields
  provider_id INTEGER,
  provider_user_id TEXT,
  provider_avatar_url TEXT,
  -- ... other fields
);
```

**`_session` table** (refresh tokens):
```sql
CREATE TABLE _session (
  user BLOB NOT NULL,            -- UUID reference to _user.id
  refresh_token TEXT NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (user, refresh_token)
);
```

**File**: `trailbase/crates/core/src/constants.rs`

---

### Public Key Endpoint

For external services to validate TrailBase tokens.

#### Endpoint

```
GET /api/_admin/public_key
```

#### Response

```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
-----END PUBLIC KEY-----
```

Returns the EdDSA public key in PEM format.

#### Use Case

External services can use this public key to validate TrailBase JWT tokens without network calls.

#### Source Code Reference

**File**: `trailbase/crates/core/src/admin/jwt.rs`

```rust
pub async fn get_public_key(
  State(state): State<AppState>
) -> Result<Response, Error> {
  Ok((StatusCode::OK, state.jwt().public_key()).into_response())
}
```

---

### Test Infrastructure

TrailBase includes comprehensive test utilities.

#### Test State Creation (Rust Tests)

**File**: `trailbase/crates/core/src/app_state.rs`
**Lines**: 520-600

```rust
#[cfg(test)]
pub async fn test_state(
  options: Option<TestStateOptions>
) -> anyhow::Result<AppState>
```

Creates a complete in-memory TrailBase instance with:
- ✅ Temporary SQLite database
- ✅ Pre-configured test config
- ✅ Test JWT keypair (auto-generated)
- ✅ Optional test mailer

#### Test Examples

**File**: `trailbase/crates/core/src/auth/auth_test.rs`
**Lines**: 38-283

```rust
async fn setup_state_and_test_user(
  email: &str,
  password: &str,
) -> (AppState, TestAsyncSmtpTransport, User) {
  let mailer = TestAsyncSmtpTransport::new();
  let state = test_state(Some(TestStateOptions {
    mailer: Some(Mailer::Smtp(Arc::new(mailer.clone()))),
    ..Default::default()
  })).await.unwrap();

  let user = register_test_user(&state, &mailer, email, password).await;
  return (state, mailer, user);
}
```

**Usage in tests**:
```rust
#[tokio::test]
async fn test_login_flow() {
  let (state, _mailer, user) =
    setup_state_and_test_user("test@example.com", "password123").await;

  // Test login
  let tokens = login_with_password(
    &state,
    "test@example.com",
    "password123",
    Duration::hours(1)
  ).await.unwrap();

  assert!(!tokens.auth_token.is_empty());
}
```

---

### Alternative Auth Flows

TrailBase supports multiple authentication flows:

#### 1. Password Login (Direct)

```
POST /api/auth/v1/login {email, password}
→ {auth_token, refresh_token, csrf_token}
```

**Use case**: Simple login, no additional security needed.

#### 2. Password Login with PKCE (Authorization Code Flow)

```
1. POST /api/auth/v1/login {email, password, pkce_code_challenge}
   → {authorization_code}

2. POST /api/auth/v1/token {authorization_code, pkce_code_verifier}
   → {auth_token, refresh_token, csrf_token}
```

**Use case**: Mobile apps, SPAs (prevents auth code interception).

#### 3. OAuth (Google, etc.)

```
1. GET /api/auth/v1/oauth/google
   → Redirects to Google

2. Google redirects back to:
   /api/auth/v1/oauth/google/callback?code=...
   → TrailBase exchanges code for tokens
   → Sets cookies and redirects to app
```

**Use case**: Social login, production apps.

#### 4. Token Refresh

```
POST /api/auth/v1/refresh
Refresh-Token: <refresh_token>
→ {auth_token, refresh_token (new), csrf_token}
```

**Use case**: Extend session without re-login.

---

### Authentication Documentation

**Official Documentation**:
`trailbase/docs/src/content/docs/documentation/auth.mdx`

**Key Points**:
- Auth tokens expire frequently (2 min in debug, 60 min in production)
- Refresh tokens are opaque and stateful (stored in database)
- Default TTLs: auth_token=60min, refresh_token=30days
- Tokens can be provided via headers or cookies
- OAuth providers supported: Google, Microsoft, Discord, GitHub, GitLab

---

## Recommended Implementation

Based on industry best practices and TrailBase's capabilities, here's the complete implementation guide for **Option 1: Hybrid Approach**.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ DEVELOPMENT ENVIRONMENT (Long-running)                      │
│                                                              │
│  Developer's Machine                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │ TrailBase Server (Port 7000)                       │    │
│  │  - Real Google OAuth configured                    │    │
│  │  - Persistent data directory                       │    │
│  │  - OAuth: localhost:7000/api/auth/v1/oauth/...     │    │
│  └────────────────────────────────────────────────────┘    │
│                      ↑                                       │
│                      │ Proxy                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Vite Dev Server (Port 5173)                        │    │
│  │  - Proxies /api → http://localhost:7000            │    │
│  │  - Proxies /_ → http://localhost:7000              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TESTING ENVIRONMENT (Ephemeral)                             │
│                                                              │
│  Test Suite A                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. Spin up TrailBase (Port 7001, /tmp/test-a)      │    │
│  │ 2. Create test user via Admin API                  │    │
│  │ 3. Login to get JWT token                          │    │
│  │ 4. Run Playwright tests with token                 │    │
│  │ 5. Cleanup (kill server, delete /tmp/test-a)       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Test Suite B (Parallel)                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Same pattern, Port 7002, /tmp/test-b               │    │
│  │ ✓ Fully isolated from Test Suite A                 │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Development Setup

#### Current Setup (Keep As-Is)

Your existing development setup already follows best practices:

```bash
# One server per developer
./server/run-fresh.sh /path/to/traildepot

# Vite config already proxies correctly
# client/vite.config.ts:
server:
  proxy:
    '/api': 'http://localhost:7000'
    '/_': 'http://localhost:7000'
```

**Google OAuth Configuration**:
- Redirect URL: `http://localhost:7000/api/auth/v1/oauth/google/callback`
- JavaScript Origin: `http://localhost:7000`, `http://localhost:5173`

**No changes needed for development!**

---

### Testing Setup

#### Port Allocation Strategy

**Option A: Random Ports** (Simple)
```typescript
const port = 7000 + Math.floor(Math.random() * 1000);
```

**Option B: Sequential Allocation** (Better for debugging)
```typescript
// Global counter or find next available port
const port = await findAvailablePort(7000, 8000);
```

**Option C: Named Ports** (Best for long-running test servers)
```typescript
const ports = {
  'unit-tests': 7001,
  'e2e-tests': 7002,
  'playwright-tests': 7003,
  'dev-alice': 7010,
  'dev-bob': 7011,
};
```

#### Directory Isolation

Each test server needs its own data directory:

```bash
# Unique per test run
DATA_DIR="/tmp/trailbase-test-${TIMESTAMP}-${RANDOM}"

# Or named for specific purposes
DATA_DIR="/tmp/trailbase-test-playwright"
DATA_DIR="/tmp/trailbase-test-unit"
```

#### Server Lifecycle Management

**Before Tests**:
1. Allocate port
2. Create temporary data directory
3. Start TrailBase server
4. Wait for server to be ready (health check)

**During Tests**:
5. Create test users via Admin API
6. Login to get tokens
7. Run tests with tokens

**After Tests**:
8. Stop TrailBase server (kill process)
9. Clean up data directory (optional: keep for debugging)

---

### TypeScript Test Helper Library

Create reusable utilities for test authentication.

#### File Structure

```
test-utils/
├── trailbase-server.ts    # Server lifecycle management
├── trailbase-auth.ts      # Authentication helpers
└── playwright-helpers.ts  # Playwright-specific utilities
```

#### Implementation

See [Implementation Examples](#implementation-examples) section below for complete code.

---

### Migration Path

#### Phase 1: Add Test Helpers (Week 1)

1. Create `test-utils/` directory structure
2. Implement server lifecycle utilities
3. Implement auth helpers
4. Write example tests

**Effort**: 1-2 days

#### Phase 2: Update Existing Tests (Week 2-3)

1. Identify tests that currently use OAuth
2. Refactor to use programmatic auth
3. Update test setup/teardown
4. Verify tests still pass

**Effort**: 3-5 days (depends on test count)

#### Phase 3: CI/CD Integration (Week 3-4)

1. Configure parallel test execution
2. Add health checks
3. Configure cleanup jobs
4. Monitor flakiness

**Effort**: 2-3 days

#### Phase 4: Documentation & Onboarding (Week 4)

1. Update README with new testing approach
2. Create developer onboarding guide
3. Run team training session

**Effort**: 1-2 days

**Total Effort**: 2-3 weeks (part-time) or 1 week (full-time)

---

## Implementation Examples

Complete, copy-paste-ready code examples.

---

### TypeScript: Server Lifecycle Management

```typescript
// test-utils/trailbase-server.ts

import { spawn, ChildProcess } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import fetch from 'node-fetch';

export interface TrailBaseServerOptions {
  port?: number;
  dataDir?: string;
  autoCleanup?: boolean;
}

export class TrailBaseServer {
  private process?: ChildProcess;
  private _port: number;
  private _dataDir: string;
  private autoCleanup: boolean;

  constructor(options: TrailBaseServerOptions = {}) {
    this._port = options.port || this.findRandomPort();
    this._dataDir = options.dataDir || this.generateTempDir();
    this.autoCleanup = options.autoCleanup ?? true;
  }

  get port(): number {
    return this._port;
  }

  get dataDir(): string {
    return this._dataDir;
  }

  get baseUrl(): string {
    return `http://localhost:${this._port}`;
  }

  private findRandomPort(): number {
    return 7000 + Math.floor(Math.random() * 1000);
  }

  private generateTempDir(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `/tmp/trailbase-test-${timestamp}-${random}`;
  }

  /**
   * Start the TrailBase server
   */
  async start(): Promise<void> {
    // Ensure data directory exists
    if (!existsSync(this._dataDir)) {
      await mkdir(this._dataDir, { recursive: true });
    }

    // Start server using run-fresh.sh
    const scriptPath = `${__dirname}/../../server/run-fresh.sh`;

    this.process = spawn(scriptPath, [this._dataDir], {
      env: {
        ...process.env,
        TRAIL_PORT: this._port.toString(),
      },
      stdio: 'pipe',
    });

    // Log output for debugging
    this.process.stdout?.on('data', (data) => {
      console.log(`[TrailBase:${this._port}] ${data}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[TrailBase:${this._port} ERROR] ${data}`);
    });

    // Wait for server to be ready
    await this.waitForReady();
  }

  /**
   * Wait for server to be ready (health check)
   */
  private async waitForReady(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${this.baseUrl}/api/healthz`, {
          method: 'GET',
        });

        if (response.ok) {
          console.log(`TrailBase server ready on port ${this._port}`);
          return;
        }
      } catch (err) {
        // Server not ready yet, continue waiting
      }

      // Wait 500ms before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(
      `TrailBase server failed to start within ${timeoutMs}ms`
    );
  }

  /**
   * Stop the TrailBase server
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        this.process?.on('exit', () => resolve());

        // Force kill after 5 seconds
        setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);
      });

      this.process = undefined;
    }

    // Cleanup data directory if requested
    if (this.autoCleanup && existsSync(this._dataDir)) {
      await rm(this._dataDir, { recursive: true, force: true });
      console.log(`Cleaned up data directory: ${this._dataDir}`);
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.process !== undefined && !this.process.killed;
  }
}
```

---

### TypeScript: Authentication Helpers

```typescript
// test-utils/trailbase-auth.ts

import fetch from 'node-fetch';

export interface CreateUserOptions {
  email: string;
  password: string;
  verified?: boolean;
  admin?: boolean;
}

export interface UserCredentials {
  userId: string;
  email: string;
  password: string;
  authToken: string;
  refreshToken: string;
  csrfToken: string;
}

export class TrailBaseAuth {
  constructor(private baseUrl: string) {}

  /**
   * Create a test user via Admin API
   */
  async createUser(options: CreateUserOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/_admin/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: options.email,
        password: options.password,
        verified: options.verified ?? true,
        admin: options.admin ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to create user: ${response.status} ${error}`
      );
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Login and get authentication tokens
   */
  async login(
    email: string,
    password: string
  ): Promise<Omit<UserCredentials, 'userId'>> {
    const response = await fetch(`${this.baseUrl}/api/auth/v1/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      email,
      password,
      authToken: data.auth_token,
      refreshToken: data.refresh_token,
      csrfToken: data.csrf_token,
    };
  }

  /**
   * Create user and login in one step
   */
  async createUserAndLogin(
    options: CreateUserOptions
  ): Promise<UserCredentials> {
    const userId = await this.createUser(options);
    const credentials = await this.login(options.email, options.password);

    return {
      userId,
      ...credentials,
    };
  }

  /**
   * Create a random test user
   */
  async createRandomUser(): Promise<UserCredentials> {
    const randomId = Math.random().toString(36).substring(7);
    const email = `test-${randomId}@example.com`;
    const password = `password-${randomId}`;

    return this.createUserAndLogin({
      email,
      password,
      verified: true,
      admin: false,
    });
  }
}
```

---

### TypeScript: Playwright Helpers

```typescript
// test-utils/playwright-helpers.ts

import { Page, BrowserContext } from '@playwright/test';
import { UserCredentials } from './trailbase-auth';

/**
 * Inject authentication token into Playwright browser context
 */
export async function setAuthToken(
  context: BrowserContext,
  credentials: UserCredentials,
  domain: string = 'localhost'
): Promise<void> {
  await context.addCookies([
    {
      name: 'auth_token',
      value: credentials.authToken,
      domain,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'refresh_token',
      value: credentials.refreshToken,
      domain,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Set auth token via HTTP header (for API testing)
 */
export function getAuthHeaders(credentials: UserCredentials): Record<string, string> {
  return {
    'Authorization': `Bearer ${credentials.authToken}`,
  };
}

/**
 * Check if user is authenticated by inspecting cookies
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some(cookie => cookie.name === 'auth_token');
}
```

---

### Playwright Test Example

```typescript
// tests/e2e/counter.test.ts

import { test, expect } from '@playwright/test';
import { TrailBaseServer } from '../test-utils/trailbase-server';
import { TrailBaseAuth } from '../test-utils/trailbase-auth';
import { setAuthToken } from '../test-utils/playwright-helpers';

// Setup server for all tests in this file
let server: TrailBaseServer;
let auth: TrailBaseAuth;

test.beforeAll(async () => {
  // Start TrailBase server on random port
  server = new TrailBaseServer({
    autoCleanup: true,
  });
  await server.start();

  auth = new TrailBaseAuth(server.baseUrl);

  console.log(`Test server running at ${server.baseUrl}`);
});

test.afterAll(async () => {
  // Cleanup
  await server.stop();
});

test('authenticated user can view and increment counter', async ({ page, context }) => {
  // Create test user and get auth token
  const user = await auth.createRandomUser();

  // Inject auth token into browser
  await setAuthToken(context, user);

  // Navigate to app
  await page.goto('http://localhost:5173');

  // Verify user is logged in (check for user email or logout button)
  await expect(page.locator('text=Logout')).toBeVisible();

  // Test counter functionality
  const counter = page.locator('[data-testid="counter"]');
  await expect(counter).toHaveText('0');

  const incrementButton = page.locator('[data-testid="increment"]');
  await incrementButton.click();

  await expect(counter).toHaveText('1');
});

test('unauthenticated user sees login prompt', async ({ page }) => {
  // Don't inject auth token
  await page.goto('http://localhost:5173');

  // Should see login button
  await expect(page.locator('text=Login with Google')).toBeVisible();
});

test('multiple users have separate counters', async ({ browser }) => {
  // Create two different users
  const user1 = await auth.createRandomUser();
  const user2 = await auth.createRandomUser();

  // User 1 session
  const context1 = await browser.newContext();
  await setAuthToken(context1, user1);
  const page1 = await context1.newPage();
  await page1.goto('http://localhost:5173');

  // User 2 session
  const context2 = await browser.newContext();
  await setAuthToken(context2, user2);
  const page2 = await context2.newPage();
  await page2.goto('http://localhost:5173');

  // User 1 increments counter
  await page1.locator('[data-testid="increment"]').click();
  await expect(page1.locator('[data-testid="counter"]')).toHaveText('1');

  // User 2 should still see 0
  await expect(page2.locator('[data-testid="counter"]')).toHaveText('0');

  // Cleanup
  await context1.close();
  await context2.close();
});
```

---

### Python: Authentication Test Script

A complete Python script for testing TrailBase authentication without TypeScript dependencies. Located in `test/test_auth.py`.

**Features:**
- Admin login with CSRF token handling
- User creation via Admin API
- Test user login
- JWT token decoding and display
- Human-readable timestamps
- Comprehensive error handling

**Installation:**
```bash
pip install -r test/requirements.txt
```

**Usage:**
```bash
python3 test/test_auth.py http://localhost:7000 \
  --admin-email admin@localhost \
  --admin-password your_admin_password
```

**Output Example:**
```
============================================================
  TrailBase Authentication Test
============================================================
Server: http://localhost:7000

============================================================
  Step 1: Login as Admin
============================================================
  Email:    admin@localhost
  Password: ********************

✓ Admin login successful!
  Auth Token:  eyJ0eXAiOiJKV1QiLCJhbGc...
  CSRF Token:  lg4t2ZBtMm9wPsgFWTQU

============================================================
  Step 2: Creating Test User
============================================================
  Email:    test-4fk4o0@example.com
  Password: secure-cczt1jks

✓ User created successfully!
  User ID: 3d2fa8a2-1fa8-4acc-af3f-4cab59bb5ca9

============================================================
  Step 3: Login as Test User
============================================================
✓ Login successful!

  Auth Token (JWT):    eyJ0eXAiOiJKV1QiLCJhbGc...
  Refresh Token:       40JkLuGtpahNSy3hDXzs...
  CSRF Token:          jnNZeYHD6ghh02dldXjz

============================================================
  Step 4: Decoded JWT Claims
============================================================
{
  "sub": "PS-ooh-oSsyvP0yrWbtcqQ==",
  "iat": 1764978600,
  "exp": 1764982200,
  "email": "test-4fk4o0@example.com",
  "csrf_token": "jnNZeYHD6ghh02dldXjz"
}

  Issued At:  2025-12-05 23:50:00
  Expires At: 2025-12-06 00:50:00
  Valid For:  59 minutes

============================================================
  Summary
============================================================
✓ Admin Login:   admin@localhost
✓ User Created:  test-4fk4o0@example.com
✓ User ID:       3d2fa8a2-1fa8-4acc-af3f-4cab59bb5ca9
✓ User Login:    SUCCESS
✓ Tokens:        auth_token, refresh_token, csrf_token

============================================================
  ✓ Authentication test completed successfully!
============================================================
```

**Key Implementation Details:**

```python
# Admin API requires both JWT token AND CSRF token header
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {auth_token}",
    "CSRF-Token": csrf_token  # Critical for Admin API
}

# Create user via Admin API
response = requests.post(
    f"{base_url}/api/_admin/user",
    json={
        "email": email,
        "password": password,
        "verified": True,  # Skip email verification
        "admin": False
    },
    headers=headers
)

# Login to get tokens
response = requests.post(
    f"{base_url}/api/auth/v1/login",
    json={"email": email, "password": password}
)
tokens = response.json()
# Returns: {auth_token, refresh_token, csrf_token}
```

**Use Cases:**
- Quick API testing without setting up TypeScript environment
- CI/CD integration with Python-based test suites
- Manual verification of authentication flow
- Debugging authentication issues
- Validating server configuration

See `test/README.md` for complete documentation.

---

### Bash: Enhanced run-fresh.sh

Update your `run-fresh.sh` to support custom ports:

```bash
#!/bin/bash
# server/run-fresh.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAILBASE_DIR="$SCRIPT_DIR/../trailbase"
TRAIL_BINARY="$TRAILBASE_DIR/target/x86_64-unknown-linux-gnu/release/trail"
TEMPLATE_DIR="$SCRIPT_DIR/template"

# Get traildepot directory from argument
if [ -z "$1" ]; then
    echo "Usage: $0 <traildepot-directory> [--port PORT]"
    echo "Example: $0 /tmp/trailbase-test --port 7001"
    exit 1
fi

DATA_DIR="$1"
shift  # Remove first argument

# Parse optional port argument
PORT=7000
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ... (rest of existing setup code) ...

echo ""
echo "Starting TrailBase server..."
echo "Data directory: $DATA_DIR"
echo "Port: $PORT"
echo "Admin dashboard: http://localhost:$PORT/_/admin/"
echo ""

# Run TrailBase server with custom port
"$TRAIL_BINARY" --data-dir="$DATA_DIR" run --address=0.0.0.0:$PORT --dev
```

Usage:
```bash
# Default port 7000
./run-fresh.sh /tmp/test1

# Custom port
./run-fresh.sh /tmp/test2 --port 7002
```

---

### Package.json Scripts

Add test scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:server": "ts-node tests/start-test-server.ts"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "node-fetch": "^2.7.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.3.0"
  }
}
```

---

## Migration Guide

Step-by-step guide to migrate from current setup to the Hybrid Approach.

### Prerequisites

- [ ] Current setup is working (development server + Vite client)
- [ ] Tests exist (or plan to create them)
- [ ] Team is informed of the change

### Phase 1: Add Test Infrastructure (No Breaking Changes)

**Duration**: 1-2 days

#### Step 1.1: Create Test Utils Directory

```bash
mkdir -p test-utils
```

#### Step 1.2: Implement Server Lifecycle Manager

Copy the `TrailBaseServer` class from [TypeScript: Server Lifecycle Management](#typescript-server-lifecycle-management) into:

```
test-utils/trailbase-server.ts
```

#### Step 1.3: Implement Auth Helpers

Copy the `TrailBaseAuth` class from [TypeScript: Authentication Helpers](#typescript-authentication-helpers) into:

```
test-utils/trailbase-auth.ts
```

#### Step 1.4: Implement Playwright Helpers

Copy the helper functions from [TypeScript: Playwright Helpers](#typescript-playwright-helpers) into:

```
test-utils/playwright-helpers.ts
```

#### Step 1.5: Update run-fresh.sh

Add `--port` option support to `server/run-fresh.sh` (see [Bash: Enhanced run-fresh.sh](#bash-enhanced-run-freshsh)).

#### Step 1.6: Install Dependencies

```bash
npm install --save-dev node-fetch @types/node-fetch
```

#### Step 1.7: Test the Infrastructure

Create a simple test to verify everything works:

```bash
# tests/infrastructure-test.ts
import { TrailBaseServer } from '../test-utils/trailbase-server';
import { TrailBaseAuth } from '../test-utils/trailbase-auth';

async function test() {
  const server = new TrailBaseServer();
  await server.start();

  const auth = new TrailBaseAuth(server.baseUrl);
  const user = await auth.createRandomUser();

  console.log('✓ Server started successfully');
  console.log('✓ User created:', user.email);
  console.log('✓ Auth token received');

  await server.stop();
  console.log('✓ Server stopped and cleaned up');
}

test().catch(console.error);
```

Run:
```bash
npx ts-node tests/infrastructure-test.ts
```

**Expected output**:
```
TrailBase server ready on port 7xxx
✓ Server started successfully
✓ User created: test-abc123@example.com
✓ Auth token received
Cleaned up data directory: /tmp/trailbase-test-xxx
✓ Server stopped and cleaned up
```

**Checkpoint**: Infrastructure is ready, no existing code affected.

---

### Phase 2: Create Example Tests (Validation)

**Duration**: 1 day

#### Step 2.1: Create Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
```

#### Step 2.2: Create Example Test

Copy the counter test from [Playwright Test Example](#playwright-test-example) into:

```
tests/e2e/counter.test.ts
```

#### Step 2.3: Run Tests

```bash
npm run test
```

**Checkpoint**: Tests pass, new approach validated.

---

### Phase 3: Migrate Existing Tests (If Any)

**Duration**: 3-5 days (depends on number of tests)

#### Step 3.1: Identify Tests Using OAuth

Search for tests that:
- Navigate to OAuth login flow
- Wait for Google redirect
- Handle OAuth callbacks

#### Step 3.2: Refactor Pattern

**Before** (using real OAuth):
```typescript
test('user can login', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('text=Login with Google');
  // Wait for Google OAuth page
  await page.waitForURL(/accounts\.google\.com/);
  // Fill credentials
  // ...
});
```

**After** (using programmatic auth):
```typescript
test('user can login', async ({ page, context }) => {
  const user = await auth.createRandomUser();
  await setAuthToken(context, user);

  await page.goto('http://localhost:5173');
  // User is already authenticated!
});
```

#### Step 3.3: Update Test Setup

Move from global server to per-test-file server:

**Before**:
```typescript
// All tests use shared server on port 7000
```

**After**:
```typescript
let server: TrailBaseServer;

test.beforeAll(async () => {
  server = new TrailBaseServer();
  await server.start();
});

test.afterAll(async () => {
  await server.stop();
});
```

#### Step 3.4: Verify Tests Pass

Run tests frequently during migration:
```bash
npm run test
```

**Checkpoint**: All tests migrated and passing.

---

### Phase 4: CI/CD Integration

**Duration**: 2-3 days

#### Step 4.1: Update CI Configuration

Example for GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build TrailBase
        run: |
          cd trailbase
          make static

      - name: Run tests
        run: npm run test

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

#### Step 4.2: Configure Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : undefined,  // Limit parallelism in CI
  // ...
});
```

#### Step 4.3: Add Cleanup Jobs

Ensure temporary directories are cleaned up:

```yaml
- name: Cleanup test data
  if: always()
  run: rm -rf /tmp/trailbase-test-*
```

**Checkpoint**: Tests run successfully in CI/CD.

---

### Phase 5: Documentation & Rollout

**Duration**: 1-2 days

#### Step 5.1: Update README

Add testing section:

```markdown
## Testing

### Running Tests

npm run test

### Test Architecture

Tests use ephemeral TrailBase servers with programmatic authentication.
Each test suite gets its own isolated server instance.

See `MULTI_SERVER_TESTING.md` for details.
```

#### Step 5.2: Create Onboarding Guide

Document for new team members:
- How tests work
- How to create new tests
- When to use real OAuth vs programmatic auth
- Debugging tips

#### Step 5.3: Team Training

- Demo the new approach
- Walk through example test
- Answer questions
- Share this document

**Checkpoint**: Team understands and can use the new system.

---

### Rollback Plan

If issues arise, you can rollback safely:

1. **Phase 1**: Just delete `test-utils/` directory
2. **Phase 2-3**: Revert test changes from git
3. **Phase 4**: Revert CI configuration
4. **Phase 5**: Remove documentation changes

The infrastructure is **additive only** - it doesn't break existing functionality.

---

## Troubleshooting

Common issues and solutions.

### Server Fails to Start

**Symptom**: `TrailBase server failed to start within 30000ms`

**Possible Causes**:
1. Port already in use
2. TrailBase binary not built
3. Config generation failed
4. Permissions issue

**Solutions**:

```bash
# Check if port is in use
lsof -i :7001

# Kill existing process
kill -9 $(lsof -t -i :7001)

# Rebuild TrailBase
cd trailbase && make static

# Check permissions
ls -la server/run-fresh.sh  # Should be executable
chmod +x server/run-fresh.sh
```

---

### User Creation Fails

**Symptom**: `Failed to create user: 500 Internal Server Error`

**Possible Causes**:
1. Admin API not enabled
2. Server not fully initialized
3. Database corruption

**Solutions**:

```typescript
// Add retry logic
async function createUserWithRetry(auth: TrailBaseAuth, options: CreateUserOptions) {
  for (let i = 0; i < 3; i++) {
    try {
      return await auth.createUser(options);
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

---

### Login Returns Invalid Credentials

**Symptom**: `Login failed: 401 Unauthorized`

**Possible Causes**:
1. User not created successfully
2. Email not verified (but `verified: true` should fix this)
3. Wrong password

**Solutions**:

```typescript
// Always set verified: true for test users
await auth.createUser({
  email: 'test@example.com',
  password: 'password123',
  verified: true,  // ← Critical!
  admin: false,
});
```

---

### Auth Token Not Working in Tests

**Symptom**: Tests show user as unauthenticated despite setting token

**Possible Causes**:
1. Token expired
2. Cookie domain mismatch
3. Token not injected correctly

**Solutions**:

```typescript
// Check token expiration
const decoded = JSON.parse(
  Buffer.from(authToken.split('.')[1], 'base64').toString()
);
console.log('Token expires at:', new Date(decoded.exp * 1000));

// Ensure correct domain
await context.addCookies([{
  name: 'auth_token',
  value: credentials.authToken,
  domain: 'localhost',  // Must match page domain
  path: '/',
}]);

// Verify cookie was set
const cookies = await context.cookies();
console.log('Cookies:', cookies);
```

---

### Tests Are Flaky

**Symptom**: Tests pass sometimes, fail other times

**Possible Causes**:
1. Server not fully ready
2. Race conditions
3. Port conflicts

**Solutions**:

```typescript
// Increase health check timeout
private async waitForReady(timeoutMs: number = 60000): Promise<void> {
  // ... (longer timeout)
}

// Add explicit waits in tests
await page.waitForSelector('[data-testid="counter"]');
await page.waitForLoadState('networkidle');

// Use unique ports
const port = 7000 + Math.floor(Math.random() * 1000);
```

---

### Cleanup Doesn't Work

**Symptom**: `/tmp` fills up with test directories

**Possible Causes**:
1. Tests crash before cleanup
2. Server process doesn't exit
3. `autoCleanup: false`

**Solutions**:

```typescript
// Ensure cleanup happens even on failure
test.afterAll(async () => {
  try {
    await server.stop();
  } catch (err) {
    console.error('Cleanup failed:', err);
    // Force cleanup
    await rm(server.dataDir, { recursive: true, force: true });
  }
});

// Periodic cleanup script
#!/bin/bash
# cleanup-test-data.sh
find /tmp -name "trailbase-test-*" -type d -mtime +1 -exec rm -rf {} \;
```

---

### CI Tests Fail but Local Tests Pass

**Possible Causes**:
1. Different environment variables
2. TrailBase binary not built in CI
3. Insufficient permissions
4. Port already in use

**Solutions**:

```yaml
# Ensure TrailBase is built
- name: Build TrailBase
  run: |
    cd trailbase
    make static

# Check binary exists
- name: Verify TrailBase binary
  run: ls -la trailbase/target/x86_64-unknown-linux-gnu/release/trail

# Use different port range in CI
# playwright.config.ts
const basePort = process.env.CI ? 8000 : 7000;
```

---

### OAuth Still Needed for Specific Tests

**Solution**: Create a **hybrid test suite**

```typescript
// tests/e2e/auth-flow.test.ts
// This test uses real OAuth (run manually or in staging)

test.skip('OAuth login flow', async ({ page }) => {
  // Only run this manually when testing OAuth specifically
  await page.goto('http://localhost:7000');
  await page.click('text=Login with Google');
  // ... real OAuth flow
});
```

Mark OAuth tests as `.skip()` by default, run manually when needed:

```bash
# Run all tests except OAuth
npm run test

# Run only OAuth tests (manually)
npm run test -- --grep "OAuth"
```

---

## Appendices

### Appendix A: TrailBase Source Code References

Complete reference of relevant source files.

| Component | File Path | Lines | Description |
|-----------|-----------|-------|-------------|
| **User Creation** |
| Admin API | `crates/core/src/admin/user/create_user.rs` | 32-95 | User creation endpoint |
| Test Helper | `crates/core/src/admin/user/create_user.rs` | 97-115 | `create_user_for_test()` |
| **Authentication** |
| Login API | `crates/core/src/auth/api/login.rs` | 295-322 | Password login handler |
| Token Minting | `crates/core/src/auth/tokens.rs` | 161-194 | Session creation logic |
| JWT Helper | `crates/core/src/auth/jwt.rs` | 31-120 | JWT encoding/decoding |
| User Model | `crates/core/src/auth/user.rs` | All | Database user structure |
| **Testing** |
| Test State | `crates/core/src/app_state.rs` | 520-600 | In-memory test setup |
| Auth Tests | `crates/core/src/auth/auth_test.rs` | 38-283 | Complete test examples |
| **Configuration** |
| Constants | `crates/core/src/constants.rs` | All | Table schemas, constants |
| Config | `crates/core/src/config/config.rs` | All | Server configuration |
| **Documentation** |
| Auth Docs | `docs/src/content/docs/documentation/auth.mdx` | All | Official auth documentation |

---

### Appendix B: API Endpoint Reference

Quick reference for all relevant endpoints.

#### Admin APIs

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/_admin/user` | POST | Create user | Admin token |
| `/api/_admin/public_key` | GET | Get JWT public key | None |

#### Auth APIs

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/auth/v1/login` | POST | Password login | None |
| `/api/auth/v1/token` | POST | Exchange auth code for token | None |
| `/api/auth/v1/refresh` | POST | Refresh access token | Refresh token |
| `/api/auth/v1/oauth/{provider}` | GET | Start OAuth flow | None |
| `/api/auth/v1/oauth/{provider}/callback` | GET | OAuth callback | None |

#### Health Check

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/healthz` | GET | Server health check | None |

---

### Appendix C: JWT Token Claims Reference

Complete reference of JWT token structure.

#### Standard Claims

| Claim | Type | Description | Example |
|-------|------|-------------|---------|
| `sub` | String | Subject (Base64-encoded user UUID) | `VVDoBOKbQdSnFkZlVEAAAQ==` |
| `iat` | Integer | Issued at (Unix timestamp) | `1733404800` |
| `exp` | Integer | Expires at (Unix timestamp) | `1733408400` |

#### Custom Claims

| Claim | Type | Description | Example |
|-------|------|-------------|---------|
| `email` | String | User's email address | `test@example.com` |
| `csrf_token` | String | CSRF protection token (20 chars) | `x1y2z3a4b5c6d7e8f9g0` |

#### Token Decoding

```typescript
// Decode JWT token (validation not shown)
const parts = authToken.split('.');
const payload = JSON.parse(
  Buffer.from(parts[1], 'base64').toString()
);

console.log('User ID:', payload.sub);
console.log('Email:', payload.email);
console.log('Expires:', new Date(payload.exp * 1000));
```

---

### Appendix D: Additional Resources

**TrailBase**:
- [Official Documentation](https://trailbase.io/documentation)
- [GitHub Repository](https://github.com/trailbaseio/trailbase)
- [Auth Documentation](https://trailbase.io/documentation/auth)

**Similar Tools**:
- [PocketBase](https://pocketbase.io/) - Similar BaaS with similar testing patterns
- [Supabase](https://supabase.com/) - PostgreSQL BaaS with local development support

**Testing Tools**:
- [Playwright](https://playwright.dev/) - E2E testing framework
- [Vitest](https://vitest.dev/) - Unit testing (Vite-native)

**OAuth & JWT**:
- [OAuth 2.0 RFC](https://datatracker.ietf.org/doc/html/rfc6749)
- [JWT.io](https://jwt.io/) - JWT debugger
- [PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)

**Development Tools**:
- [ngrok](https://ngrok.com/) - Tunneling service
- [localhost.run](https://localhost.run/) - Free SSH tunneling

---

## Conclusion

### Summary

The **Hybrid Approach** (Option 1) provides the best balance of:
- Development experience (real OAuth for interactive work)
- Test reliability (programmatic auth for automated tests)
- Scalability (unlimited parallel servers)
- Industry alignment (matches Supabase, PocketBase patterns)

### Key Takeaways

1. **Don't test OAuth in every test** - Most bugs don't require it
2. **Use TrailBase's Admin API** - It's designed for exactly this use case
3. **Isolate test environments** - Each test suite gets its own server
4. **Follow industry patterns** - This is how mature platforms do it

### Next Steps

1. Review this document with your team
2. Implement Phase 1 (test infrastructure)
3. Create example tests to validate approach
4. Migrate existing tests incrementally
5. Update CI/CD configuration
6. Document and train team

### Support

For questions or issues:
1. Review [Troubleshooting](#troubleshooting) section
2. Check TrailBase source code references
3. Consult with team leads
4. File issues in project repository

---

**Document Maintained By**: Development Team
**Last Updated**: 2025-12-05
**Version**: 1.0
