# Template Directory

This directory contains the reproducible configuration and migrations for initializing a fresh TrailBase traildepot.

## Contents

- `migrations/` - SQL migration files that create the database schema
  - `U1764969753__create_user_counters.sql` - Creates the `user_counters` table
- `config.textproto.template` - Template config file with placeholders for OAuth credentials
- `config-generator/` - Rust program that generates `config.textproto` from the template

## Usage

This template is used by `run-fresh.sh` to initialize new traildepot directories. The script:
1. Copies migrations from this template to the new traildepot directory
2. Generates `config.textproto` from the template using the config generator
3. Starts TrailBase which uses the generated config and runs migrations

## Config Template

The `config.textproto.template` file contains the static configuration with placeholders:
- `{{GOOGLE_OAUTH_CLIENT_ID}}` - Replaced with client ID from `.authn` file
- `{{GOOGLE_OAUTH_CLIENT_SECRET}}` - Replaced with client secret from `.authn` file

## Config Generator

The `config-generator/` directory contains a Rust program that:
- Reads the config template
- Reads OAuth credentials from `.authn` file
- Generates a customized `config.textproto` file

To build the generator:
```bash
cd config-generator
cargo build --release
```

## Adding New Migrations

To add new migrations:
1. Create the migration file in `template/migrations/` following the naming convention: `U{timestamp}__{name}.sql`
2. The migration will be automatically copied when using `run-fresh.sh`

## Modifying Configuration

To modify the static configuration:
1. Edit `config.textproto.template`
2. The changes will be applied to all new traildepot directories created with `run-fresh.sh`
