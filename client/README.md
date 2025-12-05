# TrailBase Counter Client

Simple web client for the TrailBase counter experiment.

## Prerequisites

- Node.js and npm (or pnpm/yarn)
- TrailBase server running on `http://localhost:7000`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to: http://localhost:5173

## Features

- **Custom Login Form**: Email/password authentication
- **User Registration**: Sign up new users
- **OAuth Support**: Login with Google or Discord (redirects to TrailBase OAuth flow)
- **Counter Display**: Shows current counter value for logged-in user
- **Increment Button**: Server-side counter increment
- **Realtime Updates**: Automatically updates counter when changed (via subscriptions)

## Development

The client uses:
- **TypeScript** for type safety
- **Vite** for development server and building
- **TrailBase TypeScript Client** (`trailbase` npm package) for API access

The Vite dev server is configured to proxy API requests to the TrailBase server running on port 7000.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory and can be served by TrailBase using:
```bash
trail run --public-dir=dist
```
