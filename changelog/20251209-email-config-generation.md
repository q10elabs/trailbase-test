# Email Configuration Generation

## Task Specification

Add email section generation to the config generator used by `run-fresh.sh`. The email configuration should be populated from values in the `.authn` file, similar to how OAuth credentials are currently handled.

## Requirements

- Generate email section in `config.textproto` with values from `.authn` file
- Email password should be stored in vault (similar to OAuth client secret)
- Email section should include: smtp_host, smtp_port, smtp_username, smtp_password (REDACTED), sender_name, sender_address
- Reference format: `server/traildepot/config.textproto`

## High-Level Decisions

- Email password stored in vault with key `TRAIL_EMAIL_SMTP_PASSWORD` (following OAuth pattern)
- All email fields are required - generator will error if any are missing from `.authn` file
- Email section replaces empty `email {}` block in template with populated configuration
- Email password appears as `<REDACTED>` in config file, actual value in vault

## Files Modified

- `server/template/config-generator/src/main.rs`
  - Added `AuthnData` struct to hold OAuth and email configuration
  - Updated `parse_authn_file()` to extract all email fields from `.authn` file
  - Updated `main()` to generate email section in config file
  - Updated `generate_vault_file()` to include email password in vault
  - Updated documentation comments to reflect email configuration support

## Implementation Details

- Email fields parsed from `.authn` file:
  - `EMAIL_SMTP_HOST` → `smtp_host`
  - `EMAIL_SMTP_PORT` → `smtp_port` (parsed as u16)
  - `EMAIL_SMTP_USERNAME` → `smtp_username`
  - `EMAIL_SMTP_PASSWORD` → stored in vault
  - `EMAIL_SENDER_NAME` → `sender_name`
  - `EMAIL_SENDER_ADDRESS` → `sender_address`
- Email section format matches expected output in `server/traildepot/config.textproto`
- Vault key naming follows pattern: `TRAIL_EMAIL_SMTP_PASSWORD`

## Current Status

Implementation complete. Code compiles successfully. Ready for testing with `run-fresh.sh`.
