# Client TypeScript Refactoring - Split into Multiple Files

## Task Specification

Split up the TypeScript logic for the client app into multiple files, one per concern.

The current `client/src/app.ts` file contains approximately 677 lines of code covering multiple concerns:
- UI element references and DOM manipulation
- Client initialization and state management
- Token refresh and authentication state management
- UI visibility/navigation (show/hide sections)
- Error handling UI
- Authentication operations (login, signup, logout, OAuth)
- Counter operations (load, increment, subscribe)
- Background image operations (load, upload)
- Image processing utilities (WebP conversion)
- OAuth callback handling
- Event listeners
- Application initialization

## High-Level Decisions

1. **File Structure**: Flat structure in `src/` directory (no subdirectories)
2. **State Management**: Central state module (`state.ts`) with getter/setter functions for shared state
3. **Constants**: Separate config file for application constants
4. **Types**: Keep implicit types (no explicit TypeScript interfaces created)
5. **Exports**: Use named exports throughout

## Files Modified

### Created Files:
- `client/src/config.ts` - Application constants (TRAILBASE_URL, REFRESH_INTERVAL_MS)
- `client/src/state.ts` - Central state management (client instance, subscriptions, intervals)
- `client/src/ui.ts` - DOM element references and UI manipulation functions
- `client/src/auth.ts` - Authentication operations (login, signup, logout, OAuth, token refresh)
- `client/src/counter.ts` - Counter operations (load, increment, subscribe)
- `client/src/backgroundImage.ts` - Background image operations (load, upload, image processing)

### Modified Files:
- `client/src/app.ts` - Refactored to only handle initialization, event listeners, and OAuth callback

## Implementation Details

### State Management Pattern
- State variables are exported from `state.ts` with getter/setter functions
- Getter functions ensure safe access to current state values
- Setter functions provide controlled state updates

### Module Dependencies
- `config.ts` - No dependencies
- `state.ts` - Depends on `config.ts` and `trailbase`
- `ui.ts` - No dependencies (pure DOM manipulation)
- `auth.ts` - Depends on `state.ts`, `config.ts`, `ui.ts`, `counter.ts`, `backgroundImage.ts`
- `counter.ts` - Depends on `state.ts`, `ui.ts`
- `backgroundImage.ts` - Depends on `state.ts`, `config.ts`, `ui.ts`
- `app.ts` - Depends on all other modules

### API Fixes
- Updated `list()` calls to use `pagination: { limit: 1 }` instead of `limit: 1` (correct TypeScript API)
- Fixed `create()` return value handling (returns `RecordId` directly, not an object with `id` property)
- Added proper type casting for button elements (`HTMLButtonElement`)

## Current Status

✅ **Completed** - All files created and refactored. TypeScript compilation successful. Build passes.
