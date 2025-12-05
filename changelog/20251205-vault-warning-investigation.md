# Vault Warning Investigation

## Task Specification

Investigate the warning message that appears when the TrailBase server starts:
```
[2025-12-05T22:51:46.958577Z WARN  trailbase::config] Vault not found. Falling back to empty default vault: No such file or directory (os error 2)
```

User requested investigation only - no code changes.

## Investigation Findings

### What is the Vault?

The vault is a TrailBase configuration mechanism for storing secrets separately from the main configuration file. It's implemented as a textproto file called `secrets.textproto` that contains a map of secret key-value pairs.

**Location**: The vault file is stored at:
- Path: `{data_dir}/secrets/secrets.textproto`
- Where `data_dir` is the traildepot directory (e.g., `/tmp/trailbase-test`)

### How the Vault Works

1. **Purpose**: The vault stores sensitive configuration values (secrets) separately from the main `config.textproto` file. This allows secrets to be managed independently and kept out of version control.

2. **Loading Process**:
   - When TrailBase starts, it attempts to load `secrets.textproto` from `{data_dir}/secrets/`
   - If the file doesn't exist, it logs a warning and falls back to an empty vault
   - The vault secrets are then merged with environment variables and the main config
   - Environment variables take priority over vault secrets

3. **Secret Resolution Order** (highest to lowest priority):
   1. Environment variables
   2. Vault secrets (from `secrets.textproto`)
   3. Placeholder values in config (if secret field has placeholder)

4. **Automatic Creation**: The vault file is automatically created when:
   - A config is written that contains secrets (via `write_config_and_vault_textproto`)
   - Secrets are extracted from the config and written to the vault

5. **Secret Key Format**: Secrets are stored with keys following the pattern:
   - `TRAIL_{FIELD_PATH}` where FIELD_PATH is the nested field path in uppercase with underscores
   - For OAuth providers in maps: `TRAIL_AUTH_OAUTH_PROVIDERS_{PROVIDER_KEY}_{FIELD_NAME}`
   - Example: `TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID`

6. **Placeholder Value**: Secret fields in config use the placeholder `<REDACTED>` which gets replaced with values from the vault

### Why the Warning Appears

The warning appears because:
- The `secrets/secrets.textproto` file doesn't exist in the traildepot directory
- This is **normal and expected** for a fresh installation or when no secrets are configured
- TrailBase handles this gracefully by using an empty vault
- The warning is informational - the server continues to run normally

### When Secrets Are Needed

Secrets are needed when:
- The `config.textproto` contains fields marked as secrets with placeholder values (e.g., `"<REDACTED>"`)
- OAuth client secrets, API keys, or other sensitive configuration values need to be stored
- The config generator or manual config editing includes secret fields

### Current Status

- **Warning is harmless**: The server operates normally with an empty vault
- **No action required**: If no secrets are configured, the warning can be safely ignored
- **Vault will be created automatically**: When secrets are first added to the config, the vault file will be created automatically

### Current Configuration Setup

Currently, when creating a traildepot from template:
- Secrets are embedded directly in `config.textproto` (OAuth client_id and client_secret)
- The config generator replaces placeholders `{{GOOGLE_OAUTH_CLIENT_ID}}` and `{{GOOGLE_OAUTH_CLIENT_SECRET}}` with actual values
- No vault file is created, so secrets are stored in plain text in the config file

## Files Referenced

- `trailbase/crates/core/src/config.rs` - Vault loading and merging logic
- `trailbase/crates/core/proto/vault.proto` - Vault protobuf definition
- `trailbase/crates/core/src/data_dir.rs` - Data directory structure and paths
- `server/template/config-generator/src/main.rs` - Current config generator
- `server/template/config.textproto.template` - Config template

## Key Code Locations

1. **Vault Loading** (line 381-397 in `config.rs`):
   - `load_vault_textproto_or_default()` function
   - Attempts to read `{data_dir}/secrets/secrets.textproto`
   - Falls back to empty vault if file doesn't exist

2. **Vault Merging** (line 298-303 in `config.rs`):
   - `merge_vault_and_env()` function
   - Merges vault secrets with environment variables and config

3. **Vault Writing** (line 447-468 in `config.rs`):
   - `write_config_and_vault_textproto()` function
   - Automatically creates vault file when secrets are present in config

4. **Secret Redaction** (line 309-368 in `config.rs`):
   - `recursively_redact_secrets()` function
   - Extracts secrets from config and replaces with `<REDACTED>` placeholder
   - Creates secret keys like `TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_SECRET`

## Additional Findings

- The `secrets/` directory exists in the traildepot, but `secrets.textproto` file is missing
- Other test directories (test1, test2, test3) have empty vault files (just containing the auto-generated header comment)
- The vault file is only created when secrets are actually written to it (when config contains secrets)

## Conclusion

The warning is **informational and expected** for a fresh TrailBase installation. It indicates that no secrets vault file exists, which is normal when:
- The server is running for the first time
- No secrets have been configured yet
- The configuration doesn't require any secrets

The server continues to operate normally, and the vault file will be automatically created when secrets are first added to the configuration. The warning can be safely ignored unless you're actually using secrets in your configuration.

## Follow-up: Using Vault Instead of Embedded Secrets

The user wants to modify the setup to use a vault file instead of embedding secrets directly in the config file. This would:
- Keep secrets separate from the main config
- Allow the config file to be version controlled without exposing secrets
- Use the `<REDACTED>` placeholder in config and store actual values in the vault

### Second Follow-up: Use TrailBase's Textproto Serialization

The user requested to use the same textproto serialization approach as TrailBase instead of manually formatting the vault file as a raw string.

## Implementation: Vault-Based Secret Management

### Changes Made

1. **Updated Config Template** (`server/template/config.textproto.template`):
   - Changed OAuth placeholders from `{{GOOGLE_OAUTH_CLIENT_ID}}` and `{{GOOGLE_OAUTH_CLIENT_SECRET}}` to `<REDACTED>`
   - Template now uses the standard TrailBase placeholder that gets replaced from the vault

2. **Enhanced Config Generator** (`server/template/config-generator/src/main.rs`):
   - Modified to accept 4 arguments instead of 3: template, authn file, config output, vault output
   - Generates `config.textproto` with `<REDACTED>` placeholders (no replacement needed)
   - Generates `secrets.textproto` vault file with actual secret values
   - Vault file uses proper textproto format with secret keys:
     - `TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID`
     - `TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_SECRET`
   - Escapes quotes in secret values for proper textproto formatting

3. **Updated run-fresh.sh Script**:
   - Creates `secrets/` directory before generating files
   - Calls config generator with both config and vault output paths
   - Adds verification checks:
     - Verifies `<REDACTED>` placeholders exist in config
     - Verifies vault file was created
     - Verifies vault file contains both OAuth secrets

### Benefits

- **Security**: Secrets are now stored separately from the main config file
- **Version Control**: Config file can be safely version controlled without exposing secrets
- **Best Practice**: Aligns with TrailBase's recommended vault-based secret management
- **No More Warnings**: The vault file is now created during initialization, eliminating the warning

### Files Modified

1. `server/template/config.textproto.template` - Updated to use `<REDACTED>` placeholders
2. `server/template/config-generator/src/main.rs` - Enhanced to generate both config and vault files using TrailBase's textproto serialization
3. `server/template/config-generator/Cargo.toml` - Added prost, prost-reflect, and lazy_static dependencies
4. `server/template/config-generator/build.rs` - Created build script to compile vault.proto
5. `server/template/config-generator/proto/vault.proto` - Copied from TrailBase source
6. `server/template/config-generator/.gitignore` - Updated to ignore generated files
7. `server/run-fresh.sh` - Updated to create secrets directory and generate vault file

### Technical Details

- **Vault File Format**: Textproto with map structure containing secret key-value pairs
- **Secret Key Naming**: Follows TrailBase convention: `TRAIL_{FIELD_PATH}` where path is uppercase with underscores
- **Placeholder Value**: Uses `<REDACTED>` which TrailBase recognizes and replaces from vault during startup
- **Serialization**: Uses the same approach as TrailBase:
  - Compiles `vault.proto` using `prost-build` and `prost-reflect-build`
  - Generates Rust structs and file descriptor set
  - Uses `prost_reflect` to serialize Vault struct to textproto format
  - Uses `FormatOptions::new().pretty(true).expand_any(true)` for consistent formatting
  - Requires `derive` feature for `prost-reflect` to enable `ReflectMessage` trait
  - Generated file is named `config.rs` (not `vault.rs`) when using prost-reflect-build
