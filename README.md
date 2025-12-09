# TrailBase Test Repository

A test and demonstration repository for setting up and using TrailBase servers for local development and testing. This repository demonstrates TrailBase's capabilities through practical examples and provides infrastructure for multi-server testing scenarios.

## Purpose

This repository serves as:
- **Demonstration**: Example TrailBase setup with authentication, Record APIs, and realtime subscriptions
- **Testing Infrastructure**: Tools and patterns for running multiple isolated TrailBase servers in parallel
- **Development Reference**: Working examples of server configuration, migrations, and client integration

## Project Structure

```
.
├── server/          # TrailBase server deployment and configuration
│   ├── template/    # Reproducible server configuration templates
│   └── run.sh       # Server management scripts
├── client/          # Example web client application
│   └── src/         # TypeScript source code
├── test/            # Test utilities and scripts
├── trailbase/       # TrailBase source code (git submodule)
└── changelog/       # Development history and decisions
```

## Counter Experiment Demo

The included counter application demonstrates:
- Per-user data isolation with Record APIs
- Authentication (email/password and OAuth)
- Realtime subscriptions for live updates
- Custom client implementation with TypeScript

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

**Counter app features:**
- Custom login form (email/password)
- User registration
- OAuth login (Google, Discord)
- Per-user counter with server-side increment
- Realtime updates via subscriptions

## Testing Strategies

This repository supports running multiple isolated TrailBase servers for parallel testing:

- **Development**: One long-running server with real OAuth (port 7000)
- **Testing**: Ephemeral servers with programmatic authentication (ports 7001+)
- **Isolation**: Each test suite gets its own data directory and port

**Key benefits:**
- No OAuth redirect URL limits
- Parallel test execution
- Fast, reliable tests without external dependencies
- Matches industry patterns (Supabase, PocketBase)

See [MULTI_SERVER_TESTING.md](./MULTI_SERVER_TESTING.md) for complete testing architecture, implementation examples, and migration guide.

**Test utilities:**
- Python authentication test script: `test/test_auth.py`
- Server lifecycle management patterns
- Programmatic user creation and authentication helpers

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

### Server Issues
- **Server won't start**: Ensure TrailBase binary is built (`cd trailbase && make static`)
- **Port already in use**: Check for existing processes (`lsof -i :7000`) or use a different port
- **Config errors**: Verify `config.textproto` syntax and OAuth credentials in `.authn` file

### Record API Issues
- **API not working**: Configure Record API in admin dashboard after first server start
- **Access denied**: Verify access control rules match your use case
- See [server/CONFIGURATION.md](./server/CONFIGURATION.md) for detailed setup

### Authentication Issues
- **OAuth redirect errors**: Ensure `site_url` matches server port and OAuth redirect URL is registered
- **Login fails**: Check server logs, verify user exists, ensure email is verified
- **Token refresh issues**: Check token expiration and refresh token validity

### Client Issues
- **API calls fail**: Verify server is running and Vite proxy is configured correctly
- **Realtime not working**: Check subscription setup and network connectivity
- **Counter not updating**: Verify Record API configuration and user authentication

### Testing Issues
- **Multiple servers conflict**: Use different ports and data directories for each server
- **Test user creation fails**: Ensure admin user exists and Admin API is accessible
- **Port conflicts in CI**: Use random port allocation or sequential port assignment

## Documentation

### Setup & Configuration
- [Server Setup](./server/README.md) - Server deployment and management
- [Server Configuration](./server/CONFIGURATION.md) - Record API configuration guide
- [Client Setup](./client/README.md) - Client application setup
- [Google OAuth Setup](./server/GOOGLE_OAUTH_SETUP.md) - OAuth provider configuration

### Testing & Development
- [Multi-Server Testing](./MULTI_SERVER_TESTING.md) - Testing architecture and patterns
- [Test Utilities](./test/README.md) - Authentication testing tools
- [Changelog](./changelog/) - Development history and decisions

### Reference
- [TrailBase Documentation](https://trailbase.io) - Official TrailBase docs
- [AGENTS.md](./AGENTS.md) - Repository rules and development guidelines
