# OAuth Client ID in Config File

## Task Specification

Update the config generator to insert the OAuth client ID in the main config file instead of the vault, since traildepot does not support loading the OAuth client ID from the secret vault (only the secret key).

## High-Level Decisions

1. **Client ID in config file**: OAuth client ID will be inserted directly into the generated `config.textproto` file
2. **Client secret in vault**: OAuth client secret remains in the vault file since traildepot supports loading secrets from vault
3. **Template replacement**: The config generator will replace `<REDACTED>` placeholder for `client_id` with the actual value from the authn file

## Requirements Changes

- Initial state: Both OAuth client ID and secret were stored in the vault
- Updated requirement: Client ID must be in main config file, secret remains in vault

## Files Modified

**Modified Files:**
- `server/template/config-generator/src/main.rs` - Updated to:
  - Replace `<REDACTED>` placeholder for `client_id` in template with actual value
  - Remove `client_id` from vault generation (only keep `client_secret`)
- `server/template/config-generator/README.md` - Updated documentation to reflect that client ID is in config file, not vault
- `server/run-fresh.sh` - Updated validation checks to:
  - Verify client ID is in config file (not `<REDACTED>`)
  - Verify client secret is in vault file
  - Verify client ID is NOT in vault file

## Rationales and Alternatives

1. **Client ID in config vs vault**: Chose config file because traildepot limitation - it only supports loading secrets (not client IDs) from vault
2. **Template replacement approach**: Using simple string replacement for `<REDACTED>` placeholder is straightforward and matches existing template structure

## Obstacles and Solutions

1. **Traildepot limitation**: Traildepot doesn't support loading OAuth client ID from vault - Solution: Move client ID to main config file

## Current Status

Implementation complete. Changes:
- ✅ Config generator replaces `<REDACTED>` for `client_id` with actual value
- ✅ Vault generation only includes `client_secret` (removed `client_id`)
- ✅ Documentation updated
- ✅ Validation script updated to check client ID in config (not vault)
