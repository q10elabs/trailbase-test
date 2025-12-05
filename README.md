# TrailBase Counter Experiment

A simple CRUD application demonstrating TrailBase's capabilities: authentication, Record APIs, and realtime subscriptions.

## Overview

This experiment implements a counter application where:
- Each logged-in user has their own counter
- Users can increment their counter via a button
- Counter updates are synchronized in realtime across sessions
- Custom login form with OAuth support

## Project Structure

```
.
├── server/          # TrailBase server deployment
│   ├── traildepot/  # TrailBase runtime data (auto-generated)
│   └── run.sh       # Script to start the server
├── client/          # Web client application
│   ├── src/         # TypeScript source code
│   └── index.html   # Main HTML page
└── trailbase/       # TrailBase source code (submodule)
```

## Quick Start

### 1. Build TrailBase

```bash
cd trailbase
make static
cd ..
```

### 2. Start the Server

```bash
cd server
./run.sh
```

On first run, TrailBase will:
- Create the `traildepot/` directory
- Create an admin user and print credentials to the terminal
- Apply database migrations

**Important**: After the server starts, configure the Record API:
1. Open http://localhost:7000/_/admin/
2. Log in with the admin credentials
3. Go to Tables → `user_counters` → Record API settings
4. See [server/CONFIGURATION.md](./server/CONFIGURATION.md) for detailed configuration

### 3. Start the Client

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Features

- ✅ Custom login form (email/password)
- ✅ User registration
- ✅ OAuth login (Google, Discord) - redirects to TrailBase OAuth flow
- ✅ Per-user counter display
- ✅ Server-side counter increment
- ✅ Realtime counter updates via subscriptions

## Documentation

- [Server Setup](./server/README.md) - Server configuration and setup
- [Server Configuration](./server/CONFIGURATION.md) - Record API configuration guide
- [Client Setup](./client/README.md) - Client application setup

## Development

### Server
- TrailBase runs on `http://localhost:7000`
- Admin dashboard: http://localhost:7000/_/admin/
- Data directory: `server/traildepot/`

### Client
- Vite dev server runs on `http://localhost:5173`
- API requests are proxied to the TrailBase server
- Uses TypeScript and TrailBase TypeScript client library

## Troubleshooting

### Record API not working
Make sure you've configured the Record API in the admin dashboard. See [CONFIGURATION.md](./server/CONFIGURATION.md).

### Authentication issues
- Check that the TrailBase server is running
- Verify OAuth providers are configured (if using OAuth)
- Check browser console for error messages

### Counter not updating
- Verify Record API is configured correctly
- Check browser console for subscription errors
- Ensure you're logged in

## Next Steps

- Explore TrailBase's admin dashboard
- Try the realtime features by opening multiple browser tabs
- Experiment with different access control rules
- Check out the TrailBase documentation: https://trailbase.io
