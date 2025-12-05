# Config Generator

A small Rust program that generates TrailBase `config.textproto` files from a template.

## Purpose

Reads a template config file and an authn file, then generates a customized `config.textproto` with OAuth credentials filled in.

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
- `{{GOOGLE_OAUTH_CLIENT_ID}}` - Replaced with client ID from authn file
- `{{GOOGLE_OAUTH_CLIENT_SECRET}}` - Replaced with client secret from authn file

## Authn File Format

The authn file should contain:
```
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
```
