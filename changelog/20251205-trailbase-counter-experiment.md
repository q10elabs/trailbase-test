# TrailBase Counter Experiment - Setup Plan

## Task Specification

Set up a TrailBase server deployment and a simple client application for a counter experiment. The application should:
- Allow logged-in users to see their own counter on screen
- Provide a button to increment the counter (server-side)
- Demonstrate TrailBase's CRUD capabilities, authentication, and realtime features

## High-Level Decisions

### Architecture
- **Server**: TrailBase single executable in `server/` directory
- **Client**: Simple web application in `client/` directory using TypeScript/JavaScript
- **Database Schema**: One table `user_counters` with user_id and counter value
- **API**: Record API for CRUD operations on counters
- **Authentication**: TrailBase built-in auth system

### Technology Choices
- **Server**: TrailBase binary (single executable)
- **Client**: HTML/JavaScript/TypeScript with TrailBase TypeScript client library
- **Database**: SQLite (managed by TrailBase)
- **Build Tool**: Simple setup, potentially using npm/pnpm for client dependencies

## Requirements Analysis

### Server-Side Requirements
1. TrailBase server installation/execution
2. Database migration to create `user_counters` table
3. Record API configuration for counter CRUD operations
4. Authentication setup (email/password)
5. Access control: users can only read/update their own counter

### Client-Side Requirements
1. Simple HTML/JS application
2. Authentication UI (login/signup) or use TrailBase built-in auth UI
3. Display current counter value for logged-in user
4. Button to increment counter
5. Realtime subscription to counter updates (optional but nice to have)
6. TrailBase TypeScript client library integration

## Files to Create/Modify

### Server Directory (`server/`)
- `traildepot/` - TrailBase runtime directory (auto-generated on first run)
  - `migrations/` - SQL migration files
  - `config.textproto` - Server configuration (may be auto-generated)
- `README.md` - Server setup instructions
- `run.sh` or `run.bat` - Script to start the server

### Client Directory (`client/`)
- `index.html` - Main HTML page
- `app.ts` or `app.js` - Main application logic
- `package.json` - Dependencies (TrailBase client library)
- `tsconfig.json` - TypeScript configuration (if using TS)
- `README.md` - Client setup instructions
- `vite.config.ts` or build configuration (optional, for dev server)

## Implementation Approach

### Phase 1: Server Setup
1. Create `server/` directory structure
2. Set up TrailBase server configuration
3. Create database migration for `user_counters` table
4. Configure Record API for counters with proper access control
5. Test server startup and admin dashboard

### Phase 2: Client Setup
1. Create `client/` directory structure
2. Set up basic HTML/JS application
3. Install TrailBase TypeScript client library
4. Implement authentication flow
5. Implement counter display and increment functionality
6. Add realtime subscription for counter updates

### Phase 3: Integration & Testing
1. Test end-to-end flow
2. Verify authentication works
3. Verify counter increments persist
4. Verify realtime updates work
5. Document setup and usage

## Key TrailBase Concepts to Use

1. **Migrations**: SQL files in `traildepot/migrations/` for schema setup
2. **Record APIs**: Configure in `config.textproto` or via admin dashboard
3. **Access Control**: Use `acl_authenticated` and `access_rule` for user-specific data
4. **Realtime Subscriptions**: Use `api.subscribe()` for live updates
5. **Authentication**: Use TrailBase's built-in auth APIs or UI

## Requirements Changes

Based on user clarification:
1. **Authentication UI**: Custom login form with OAuth redirects to TrailBase OAuth flow
2. **Counter Scope**: One counter per user (already planned)
3. **Client Tech**: TypeScript (closest to TrailBase SDK)
4. **Dev Server**: Separate Vite dev server for client
5. **Build Method**: Build TrailBase from source using `make static` in trailbase directory

## Files Modified

### Server Directory (`server/`)
- `README.md` - Server setup instructions
- `run.sh` - Script to start TrailBase server
- `traildepot/migrations/U<timestamp>__create_user_counters.sql` - Database migration
- `traildepot/config.textproto` - Server configuration (auto-generated, may need manual edits)

### Client Directory (`client/`)
- `package.json` - Dependencies (trailbase npm package, vite, typescript)
- `index.html` - Main HTML page with custom login form
- `app.ts` - TypeScript application logic
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite dev server configuration
- `README.md` - Client setup instructions

## Current Status

**Status**: Implementation complete - ready for testing

## Files Created

### Server (`server/`)
- `README.md` - Server setup instructions
- `run.sh` - Script to start TrailBase server
- `CONFIGURATION.md` - Record API configuration guide
- `GOOGLE_OAUTH_SETUP.md` - Step-by-step Google OAuth setup guide
- `traildepot/migrations/U1764969753__create_user_counters.sql` - Database migration

### Client (`client/`)
- `package.json` - Dependencies (trailbase, vite, typescript)
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite dev server with proxy configuration
- `index.html` - Main HTML page with custom login form and counter UI
- `src/app.ts` - TypeScript application logic
- `README.md` - Client setup instructions

## Implementation Details

### Server-Side
- Database migration creates `user_counters` table with proper foreign key to `_user` table
- Table uses STRICT typing for Record API compatibility
- Unique constraint on `user` column ensures one counter per user

### Client-Side
- Custom login form with email/password authentication
- User registration with email verification support
- OAuth redirect buttons (Google, Discord) that redirect to TrailBase OAuth flow
- Counter display showing current value
- Increment button that updates counter server-side
- Realtime subscription to counter changes using TrailBase's subscribe API
- Automatic counter creation on first access
- Error handling and user feedback

### Access Control
- Record API configured with access rules ensuring users can only access their own counters
- Uses `_ROW_.user = _USER_.id` for read/update operations
- Uses `_REQ_.user = _USER_.id` for create operations

## Implementation Notes

### Access Control Strategy
- Used `autofill_missing_user_id_columns: true` to automatically fill the `user` field when creating counters
- Access rules (`_ROW_.user = _USER_.id`) ensure users can only access their own counters
- Client code relies on access rules for filtering, so no explicit user filter needed in list queries

### Client Code Optimizations
- Removed explicit user filtering from list queries (access rules handle this)
- Added comments explaining autofill behavior
- Simplified counter creation by relying on TrailBase's autofill feature

## Next Steps

1. ⏳ Test the complete setup
2. ⏳ Verify Record API configuration works correctly
3. ⏳ Test authentication flows (email/password and OAuth)
4. ⏳ Test counter increment and realtime updates
5. ✅ Created comprehensive README and documentation
6. ✅ Created Google OAuth setup guide with step-by-step instructions
7. ✅ Fixed OAuth redirect validation issue by adding --dev flag and --public-url

## Issues Fixed

### OAuth Redirect Validation Error
**Problem**: "invalid redirect" error when clicking Google OAuth login button

**Root Cause**: 
- Server wasn't started with `--dev` flag
- `site_url` wasn't configured to match the server port (7000)
- TrailBase's redirect validation rejected `http://localhost:5173` because it didn't match the site URL

**Solution**:
- Added `--dev` flag to `server/run.sh` to enable dev mode (allows localhost redirects to different ports)
- Added `--public-url=http://localhost:7000` to set the site_url
- Updated all documentation references from port 4000 to 7000

**Files Modified**:
- `server/run.sh` - Added --dev and --public-url flags
- `server/OAUTH_REDIRECT_FIX.md` - Documentation of the fix
- Updated port references in all documentation files

### User ID Column Type Fix
**Problem**: Migration used INTEGER for `user` column, but `_user.id` is BLOB (UUID)

**Solution**:
- Updated migration to use BLOB type for `user` column to match `_user.id`
- Client now explicitly passes `user.id` (base64-encoded UUID string) in create requests
- TrailBase automatically converts base64 UUID strings to BLOB when inserting

**Files Modified**:
- `server/traildepot/migrations/U1764969753__create_user_counters.sql` - Changed `user` column from INTEGER to BLOB
- `client/src/app.ts` - Updated to explicitly pass `user.id` when creating counters
- `server/CONFIGURATION.md` - Removed autofill references, updated to reflect explicit user ID passing

### Fresh Run Script for Reproducibility
**Request**: Create an alternate run script that takes a directory as argument and initializes it anew as traildepot every time it is run, with OAuth credentials from `.authn` file.

**Solution**:
- Created `server/run-fresh.sh` script that:
  1. Takes a directory path as argument
  2. Removes the directory if it exists (fresh start)
  3. Creates a new directory
  4. Initializes TrailBase to generate config.textproto
  5. Automatically injects OAuth credentials from `server/.authn` file
  6. Starts TrailBase server
- Uses Python for robust textproto manipulation with sed fallback
- Provides clear error messages and verification

**Files Created**:
- `server/run-fresh.sh` - Fresh run script for reproducibility
- `server/template/migrations/U1764969753__create_user_counters.sql` - Migration template
- `server/template/README.md` - Template directory documentation

**Files Modified**:
- `server/README.md` - Added documentation for `run-fresh.sh` script and template directory

### Template Directory for Reproducibility
**Problem**: `run-fresh.sh` was missing migrations, causing "Missing table or view for API: counters" error. The Record API was configured but the table didn't exist.

**Solution**:
- Created `server/template/` directory with reproducible configuration
- Template contains migrations that are copied to fresh traildepot directories
- Updated `run-fresh.sh` to:
  1. Copy migrations from template before starting TrailBase
  2. Let TrailBase run migrations to create tables
  3. Then inject Record API configuration (which references the now-existing table)

**Files Created**:
- `server/template/migrations/U1764969753__create_user_counters.sql` - Migration file template
- `server/template/README.md` - Documentation for template directory

**Files Modified**:
- `server/run-fresh.sh` - Added template directory support and migration copying

### Site URL Configuration in Config File
**Problem**: Using `--public-url` command-line argument instead of configuring `site_url` in the config file, causing log warnings.

**Solution**:
- Updated `run-fresh.sh` to inject `site_url: "http://localhost:7000"` into the `server` section of config.textproto
- Updated `run.sh` to automatically add `site_url` to existing config if missing
- Removed `--public-url` command-line arguments from both scripts
- Configuration is now persistent in the config file

**Files Modified**:
- `server/run-fresh.sh` - Injects `site_url` into config, removed `--public-url` flag
- `server/run.sh` - Adds `site_url` to config if missing, removed `--public-url` flag
- `server/OAUTH_REDIRECT_FIX.md` - Updated to reflect config file approach

### Rust Config Generator
**Request**: Replace inline Python script with a Rust program that reads a template config file and generates customized config.

**Solution**:
- Created `server/template/config-generator/` - Rust program that generates config from template
- Created `server/template/config.textproto.template` - Template config file with placeholders
- Updated `run-fresh.sh` to use the Rust config generator instead of inline Python
- The template contains all static configuration (site_url, Record API, etc.)
- OAuth credentials are filled in from `.authn` file using placeholders

**Files Created**:
- `server/template/config-generator/Cargo.toml` - Rust project configuration
- `server/template/config-generator/src/main.rs` - Config generator program
- `server/template/config-generator/README.md` - Documentation for config generator
- `server/template/config-generator/.gitignore` - Git ignore for build artifacts
- `server/template/config.textproto.template` - Template config file with placeholders

**Files Modified**:
- `server/run-fresh.sh` - Replaced inline Python with Rust config generator
- `server/template/README.md` - Updated to document config generator and template

### Updated run.sh to Take Directory Argument
**Request**: Update `run.sh` to take traildepot directory as argument and assume it was initialized with `run-fresh.sh`.

**Solution**:
- Updated `run.sh` to accept traildepot directory as command-line argument
- Removed automatic site_url injection (assumes config is already complete from `run-fresh.sh`)
- Added validation to check directory exists and config file is present
- Provides clear error messages if directory isn't initialized

**Files Modified**:
- `server/run.sh` - Now takes directory argument, assumes initialization
- `server/README.md` - Updated documentation for both scripts
