# TrailBase Server Configuration Guide

## Record API Configuration

After starting the TrailBase server for the first time, you need to configure the Record API for the `counters` endpoint.

### Option 1: Using Admin Dashboard (Recommended)

1. Start the server: `./run.sh`
2. Open the admin dashboard: http://localhost:7000/_/admin/
3. Log in with the admin credentials printed in the terminal
4. Go to the **Tables** view
5. Find the `user_counters` table
6. Click on it, then click **Record API** settings (top right)
7. Configure the API with these settings:
   - **Name**: `counters`
   - **Table**: `user_counters`
   - **ACL Authenticated**: Check `READ`, `CREATE`, `UPDATE`
   - **Read Access Rule**: `_ROW_.user = _USER_.id`
   - **Update Access Rule**: `_ROW_.user = _USER_.id`
   - **Create Access Rule**: `_REQ_.user = _USER_.id`

### Option 2: Manual Configuration File

Alternatively, you can edit `traildepot/config.textproto` directly and add:

```textproto
record_apis: [
  {
    name: "counters"
    table_name: "user_counters"
    acl_authenticated: [READ, CREATE, UPDATE]
    read_access_rule: "_ROW_.user = _USER_.id"
    update_access_rule: "_ROW_.user = _USER_.id"
    create_access_rule: "_REQ_.user = _USER_.id"
  }
]
```

**Note**: The config file is auto-generated. Make sure to add this configuration after the server has created the initial config file.

## Access Control Explanation

- **`_ROW_.user = _USER_.id`**: Users can only read/update their own counter records
- **`_REQ_.user = _USER_.id`**: When creating a counter, the user field must match the authenticated user's ID. The client explicitly passes the user ID in the request.
- **`acl_authenticated: [READ, CREATE, UPDATE]`**: Only authenticated users can perform these operations

**Note**: The client application explicitly passes the user ID when creating counters. TrailBase validates that the provided user ID matches the authenticated user's ID using the access rule.

## OAuth Configuration (Optional)

To enable OAuth providers (Google, Discord, etc.), you can configure them in the admin dashboard under **Settings** > **Auth** > **OAuth Providers**.

**For detailed Google OAuth setup instructions, see [GOOGLE_OAUTH_SETUP.md](./GOOGLE_OAUTH_SETUP.md)**

Quick steps:
1. Register your application with the OAuth provider (e.g., Google Cloud Console)
2. Get client ID and client secret
3. Configure the redirect URI in the provider's settings:
   - For Google: `http://localhost:7000/api/auth/v1/oauth/google/callback`
4. Add the credentials in TrailBase admin dashboard or config file
