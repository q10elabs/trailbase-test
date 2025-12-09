# Register Endpoint Redirect Configuration

## Problem Statement

When using the Trailbase register endpoint (`POST /api/auth/v1/register`), the server returns a **303 See Other** redirect response that points to `http://localhost:7000/_/auth/login` with an alert query parameter (e.g., `?alert=Registered%20user@example.com...`).

However, this route (`/_/auth/login`) is not implemented in our client application. The browser automatically follows the 303 redirect, causing navigation to a non-existent route in our app.

## Current Trailbase Behavior

### Register Endpoint Implementation

The Trailbase register endpoint (`trailbase/crates/core/src/auth/api/register.rs`) currently:

- **Only accepts form-encoded data** (`application/x-www-form-urlencoded`)
- **Always returns 303 redirects** (never JSON responses)
- **Hardcodes redirect URLs**:
  - On error: `/_/auth/register?alert={message}`
  - On success: `/_/auth/login?alert={message}`
- **Does NOT accept a `redirect_uri` parameter** to customize where to redirect

### Comparison with Login Endpoint

The login endpoint (`/api/auth/v1/login`) is more flexible:

- ✅ Accepts both JSON and form-encoded data
- ✅ Returns JSON responses when JSON is sent
- ✅ Returns redirects when form data is sent
- ✅ Accepts `redirect_uri` parameter in the request
- ✅ Uses content-type detection to determine response format

## Current Client Implementation

Our current registration handler (`client/src/auth.ts`):

```typescript
const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/register`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: formData.toString(),
});
```

The browser automatically follows the 303 redirect, causing navigation to `/_/auth/login` which doesn't exist in our app.

## Available Options

### Option 1: Modify Trailbase to Support JSON and `redirect_uri` ⭐ Recommended

**Approach**: Update the Trailbase register endpoint to match the login endpoint's flexibility.

**Changes Required**:
- Modify `trailbase/crates/core/src/auth/api/register.rs` to:
  - Accept both JSON and form-encoded requests (using `Either<RegisterUserRequest>`)
  - Add `redirect_uri` field to `RegisterUserRequest`
  - Return JSON responses when JSON is sent
  - Use `redirect_uri` parameter when provided, fallback to defaults
  - Validate `redirect_uri` using existing `validate_redirect()` function

**Client Changes**:
```typescript
// Send JSON request
const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/register`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    password,
    password_repeat: password,
    redirect_uri: window.location.origin + '/login', // Optional
  }),
});

// Handle JSON response
if (response.ok) {
  const data = await response.json();
  // Handle success
} else {
  const error = await response.json();
  // Handle error
}
```

**Pros**:
- ✅ Consistent with login endpoint API design
- ✅ Clean separation: API clients get JSON, form-based UIs get redirects
- ✅ Flexible: supports both use cases
- ✅ Follows existing Trailbase patterns

**Cons**:
- ❌ Requires modifying Trailbase source code
- ❌ Need to rebuild Trailbase after changes
- ❌ May need to maintain a fork if changes aren't upstreamed

---

### Option 2: Client-Side Workaround - Prevent Redirect Following

**Approach**: Use `fetch` with `redirect: 'manual'` to intercept the 303 response and handle it in JavaScript.

**Client Changes**:
```typescript
const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/register`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: formData.toString(),
  redirect: 'manual', // Prevent automatic redirect following
});

if (response.status === 303) {
  // Extract redirect location
  const location = response.headers.get('Location');
  if (location) {
    // Parse the alert message from the redirect URL
    const url = new URL(location, TRAILBASE_URL);
    const alert = url.searchParams.get('alert');
    if (alert) {
      showError(loginError, decodeURIComponent(alert));
    }
  }
} else if (response.ok) {
  // Handle success
} else {
  // Handle error
}
```

**Pros**:
- ✅ No Trailbase modifications needed
- ✅ Works with current Trailbase version
- ✅ Can extract alert messages from redirect URL

**Cons**:
- ❌ More complex client-side code
- ❌ Relies on parsing redirect URLs (brittle)
- ❌ Doesn't solve the root issue (hardcoded redirects)
- ❌ May break if Trailbase changes redirect format

---

### Option 3: Implement the Route in Client App

**Approach**: Add a `/_/auth/login` route handler in the client app that extracts the alert and displays it.

**Client Changes**:
- Add routing for `/_/auth/login`
- Extract `alert` query parameter
- Display alert message to user
- Redirect to appropriate page in your app

**Pros**:
- ✅ Quick workaround
- ✅ No Trailbase modifications
- ✅ Can customize the login page experience

**Cons**:
- ❌ Couples your app to Trailbase's UI route structure
- ❌ Doesn't solve the underlying API design issue
- ❌ May conflict with other routes
- ❌ Not a clean solution for API clients

---

### Option 4: Check for Accept Header Support

**Approach**: Try sending `Accept: application/json` header to request JSON response.

**Client Changes**:
```typescript
const response = await fetch(`${TRAILBASE_URL}/api/auth/v1/register`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  },
  body: formData.toString(),
});
```

**Pros**:
- ✅ Simple to try
- ✅ No code changes if it works

**Cons**:
- ❌ Likely won't work (register endpoint doesn't check Accept header)
- ❌ Register endpoint uses content-type, not Accept header
- ❌ Login endpoint uses content-type detection, not Accept

**Status**: ❌ **Not supported** - Trailbase uses content-type detection, not Accept headers.

---

## Recommendation

**Option 1 (Modify Trailbase)** is the recommended approach because:

1. **Consistency**: Aligns the register endpoint with the login endpoint's API design
2. **Flexibility**: Supports both API clients (JSON) and form-based UIs (redirects)
3. **Clean Architecture**: Proper separation of concerns
4. **Future-proof**: Follows established patterns in Trailbase

If modifying Trailbase is not feasible, **Option 2 (Client-side workaround)** provides a functional solution without Trailbase changes, though it's less elegant.

## Implementation Notes

### If Choosing Option 1

The implementation should follow the pattern used in `login.rs`:

1. Change handler signature to accept `Either<RegisterUserRequest>`
2. Add `redirect_uri: Option<String>` to `RegisterUserRequest`
3. Detect content type (JSON vs form) using `Either` extractor
4. Validate `redirect_uri` using `validate_redirect()` when provided
5. Return JSON response when JSON is sent
6. Return redirect when form is sent, using `redirect_uri` if provided

### If Choosing Option 2

Ensure proper error handling for:
- Missing `Location` header
- Invalid URL parsing
- Missing or malformed alert parameters
- Network errors during redirect interception

## Related Files

- **Trailbase Register Endpoint**: `trailbase/crates/core/src/auth/api/register.rs`
- **Trailbase Login Endpoint** (reference): `trailbase/crates/core/src/auth/api/login.rs`
- **Client Registration Handler**: `client/src/auth.ts` (`handleSignup` function)
- **Trailbase Auth Constants**: `trailbase/crates/core/src/auth/mod.rs`

## References

- [Trailbase Auth Documentation](https://docs.trailbase.io/documentation/auth)
- [HTTP 303 See Other](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303)
- [Fetch API redirect handling](https://developer.mozilla.org/en-US/docs/Web/API/fetch#redirect)
