# OAuth Redirect Fix

## Problem

When clicking "Login with Google", the browser redirects to:
```
http://localhost:7000/api/auth/v1/oauth/google/login?redirect_uri=http%3A%2F%2Flocalhost%3A5173%2F
```

And TrailBase returns: **"invalid redirect"**

## Root Cause

TrailBase validates redirect URIs for security. The validation allows:
1. Relative paths (starting with `/`)
2. URLs matching the configured `site_url` exactly (same host and scheme)
3. Custom URI schemes (for mobile apps)
4. **In dev mode only**: localhost/loopback IPs (regardless of port)

The issue was:
- The server wasn't started with `--dev` flag
- The `site_url` wasn't configured to `http://localhost:7000`
- So TrailBase rejected `http://localhost:5173` because it didn't match the site URL

## Solution

Two changes were made:

1. **Added `--dev` flag**: Enables dev mode, which allows localhost redirects to different ports
2. **Set `site_url` in config file**: Added `site_url: "http://localhost:7000"` to the `server` section in `config.textproto`

The `site_url` is now configured in the config file rather than via command-line argument. The scripts automatically inject this into the config:
- `run.sh` - Adds `site_url` if missing from existing config
- `run-fresh.sh` - Automatically injects `site_url` along with OAuth and Record API config

The server command:
```bash
"$TRAIL_BINARY" --data-dir="$DATA_DIR" run --address=0.0.0.0:7000 --dev
```

## How It Works

With `--dev` flag enabled, the validation logic in `validate_redirect_impl` allows:
- Any redirect to `localhost` (regardless of port)
- Any redirect to loopback IPs (127.0.0.1, ::1)

This is safe in development because:
- Only applies to localhost/loopback addresses
- Only enabled when explicitly using `--dev` flag
- Production deployments should not use `--dev` flag

## Testing

After restarting the server with the updated script:
1. Click "Login with Google" button
2. Should redirect to Google's OAuth page (not show "invalid redirect")
3. After Google authentication, should redirect back to `http://localhost:5173`

## Production Considerations

For production:
- Remove `--dev` flag
- Set `site_url` in config to your production domain
- Update Google OAuth redirect URI to production URL
- Only allow redirects that match your site_url or are explicitly whitelisted
