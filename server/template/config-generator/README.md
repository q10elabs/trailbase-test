# Config Generator

A small Rust program that generates TrailBase `config.textproto` files from a template.

## Purpose

Reads a template config file and an authn file, then generates:
- A customized `config.textproto` with OAuth client ID inserted
- A `secrets.textproto` vault file with the OAuth client secret

Note: The OAuth client ID is stored in the main config file (not in the vault) because traildepot only supports loading secrets from the vault, not client IDs.

## Building

```bash
cargo build --release
```

The binary will be at `target/release/config-generator`.

## Usage

```bash
./target/release/config-generator <template-file> <authn-file> <output-file>
```

Example:
```bash
./target/release/config-generator \
  ../config.textproto.template \
  ../../.authn \
  /tmp/trailbase-test/config.textproto
```

## Template Format

The template file uses placeholders:
- `client_id: "<REDACTED>"` - Replaced with actual client ID from authn file in the generated config
- `client_secret: "<REDACTED>"` - Remains as `<REDACTED>` in config (actual secret is stored in vault file)

## Authn File Format

The authn file should contain:
```
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
```
