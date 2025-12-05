# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth authentication for your TrailBase counter experiment.

## Prerequisites

- TrailBase server running (see [README.md](./README.md))
- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Enter a project name (e.g., "TrailBase Counter Experiment")
5. Click **"Create"**
6. Wait for the project to be created and select it

## Step 2: Enable Google+ API (or Google Identity API)

1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Google+ API"** or **"Google Identity"**
3. Click on it and click **"Enable"**

**Note**: Google+ API is deprecated, but Google Identity API should work. If you see warnings, you can also try enabling "People API" which is the modern replacement.

## Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. If prompted, configure the OAuth consent screen first:
   - Choose **"External"** (unless you have a Google Workspace)
   - Click **"Create"**
   - Fill in the required fields:
     - **App name**: "TrailBase Counter" (or any name)
     - **User support email**: Your email
     - **Developer contact information**: Your email
   - Click **"Save and Continue"**
   - On "Scopes" page, click **"Save and Continue"**
   - On "Test users" page, you can add test users or skip
   - Click **"Back to Dashboard"**

5. Now create the OAuth client:
   - **Application type**: Select **"Web application"**
   - **Name**: "TrailBase Counter Client" (or any name)
   - **Authorized JavaScript origins**: 
     - Add: `http://localhost:7000`
     - Add: `http://localhost:5173` (for your client dev server)
   - **Authorized redirect URIs**:
     - Add: `http://localhost:7000/api/auth/v1/oauth/google/callback`
     - **Important**: This is the exact callback URL TrailBase expects
   
6. Click **"Create"**

7. **Copy the credentials**:
   - **Client ID**: A long string like `123456789-abcdefg.apps.googleusercontent.com`
   - **Client Secret**: A string like `GOCSPX-abcdefghijklmnopqrstuvwxyz`
   - **Save these** - you'll need them in the next step!

## Step 4: Configure TrailBase

You have two options to configure Google OAuth in TrailBase:

### Option A: Using Admin Dashboard (Recommended)

1. Start your TrailBase server: `./run.sh`
2. Open the admin dashboard: http://localhost:4000/_/admin/
3. Log in with your admin credentials
4. Go to **"Settings"** (gear icon in the sidebar)
5. Click on **"Auth"** tab
6. Scroll down to **"OAuth Providers"** section
7. Click **"+ Add Provider"** or **"Edit"** if Google is already listed
8. Fill in the form:
   - **Provider**: Select **"Google"** from the dropdown
   - **Client ID**: Paste your Google Client ID
   - **Client Secret**: Paste your Google Client Secret
9. Click **"Save"**

### Option B: Manual Configuration File

1. Stop your TrailBase server (Ctrl+C)
2. Edit `traildepot/config.textproto`
3. Find the `auth` section and add/update the `oauth_providers` array:

```textproto
auth {
  oauth_providers: [
    {
      key: "google"
      value {
        client_id: "YOUR_CLIENT_ID_HERE"
        client_secret: "YOUR_CLIENT_SECRET_HERE"
        provider_id: GOOGLE
      }
    }
  ]
}
```

4. Replace `YOUR_CLIENT_ID_HERE` and `YOUR_CLIENT_SECRET_HERE` with your actual credentials
5. Save the file
6. Restart the server: `./run.sh`

## Step 5: Verify Configuration

1. Make sure your TrailBase server is running
2. Open your client application: http://localhost:5173
3. Click the **"Login with Google"** button
4. You should be redirected to Google's login page
5. After logging in with your Google account, you should be redirected back to your app
6. You should now be logged in!

## Troubleshooting

### "redirect_uri_mismatch" Error

This means the redirect URI in Google doesn't match what TrailBase is sending.

**Solution**:
1. Check that you added exactly: `http://localhost:7000/api/auth/v1/oauth/google/callback`
2. Make sure there are no trailing slashes
3. If using HTTPS, make sure the protocol matches
4. Wait a few minutes after updating - Google sometimes caches redirect URIs

### "invalid_client" Error

This usually means the Client ID or Client Secret is incorrect.

**Solution**:
1. Double-check that you copied the credentials correctly
2. Make sure there are no extra spaces
3. Verify the credentials in Google Cloud Console

### OAuth Provider Not Showing in Admin Dashboard

**Solution**:
1. Make sure you saved the configuration correctly
2. Refresh the admin dashboard page
3. Check the server logs for any errors
4. Verify the `config.textproto` file syntax is correct

### "Access blocked: This app's request is invalid"

This usually means the OAuth consent screen isn't configured or the app is in testing mode.

**Solution**:
1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Make sure all required fields are filled
3. If in "Testing" mode, add your email as a test user
4. For production, you may need to publish the app (requires verification for sensitive scopes)

## Production Considerations

For production deployment:

1. **Update redirect URIs** in Google Cloud Console to match your production domain:
   - `https://yourdomain.com/api/auth/v1/oauth/google/callback`

2. **Update authorized JavaScript origins**:
   - `https://yourdomain.com`

3. **OAuth Consent Screen**:
   - Complete all required fields
   - Add your app's privacy policy and terms of service URLs
   - Submit for verification if using sensitive scopes

4. **Security**:
   - Never commit `client_secret` to version control
   - Use environment variables or secure secret management
   - Consider using Google Cloud Secret Manager

## Testing with Multiple Users

If you want to test with multiple Google accounts:

1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Scroll to **"Test users"**
3. Click **"+ ADD USERS"**
4. Add the email addresses of test accounts
5. These users will be able to sign in even if the app is in testing mode

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [TrailBase Auth Documentation](https://trailbase.io/documentation/auth)
- [Google Cloud Console](https://console.cloud.google.com/)
