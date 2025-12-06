#!/bin/bash

# Script to run TrailBase server with a fresh traildepot directory each time
# Usage: ./run-fresh.sh <traildepot-directory>
# Example: ./run-fresh.sh /tmp/trailbase-test
#
# This script:
# 1. Removes the specified directory if it exists
# 2. Creates a fresh directory
# 3. Copies migrations from template
# 4. Generates config.textproto and secrets.textproto from template using Rust config generator
# 5. Starts TrailBase server (which runs migrations and uses the generated config)

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAILBASE_DIR="$SCRIPT_DIR/../trailbase"
TRAIL_BINARY="$TRAILBASE_DIR/target/x86_64-unknown-linux-gnu/release/trail"
AUTHN_FILE="$SCRIPT_DIR/.authn"
TEMPLATE_DIR="$SCRIPT_DIR/template"
CONFIG_GENERATOR_DIR="$TEMPLATE_DIR/config-generator"
CONFIG_GENERATOR_BINARY="$CONFIG_GENERATOR_DIR/target/release/config-generator"
CONFIG_TEMPLATE="$TEMPLATE_DIR/config.textproto.template"

# Get traildepot directory from argument
if [ -z "$1" ]; then
    echo "Usage: $0 <traildepot-directory>"
    echo "Example: $0 /tmp/trailbase-test"
    exit 1
fi

DATA_DIR="$1"

# Check if TrailBase binary exists
if [ ! -f "$TRAIL_BINARY" ]; then
    echo "Error: TrailBase binary not found at $TRAIL_BINARY"
    echo "Please build it first by running: cd $TRAILBASE_DIR && make static"
    exit 1
fi

# Check if .authn file exists
if [ ! -f "$AUTHN_FILE" ]; then
    echo "Error: OAuth credentials file not found at $AUTHN_FILE"
    exit 1
fi

# Check if config template exists
if [ ! -f "$CONFIG_TEMPLATE" ]; then
    echo "Error: Config template not found at $CONFIG_TEMPLATE"
    exit 1
fi

# Build config generator if needed
if [ ! -f "$CONFIG_GENERATOR_BINARY" ]; then
    echo "Building config generator..."
    cd "$CONFIG_GENERATOR_DIR"
    if ! cargo build --release; then
        echo "Error: Failed to build config generator"
        exit 1
    fi
    cd "$SCRIPT_DIR"
fi

# Remove existing directory if it exists
if [ -d "$DATA_DIR" ]; then
    echo "Removing existing directory: $DATA_DIR"
    rm -rf "$DATA_DIR"
fi

# Create fresh directory
echo "Creating fresh traildepot directory: $DATA_DIR"
mkdir -p "$DATA_DIR"

# Copy migrations from template
if [ -d "$TEMPLATE_DIR/migrations" ] && [ -n "$(ls -A "$TEMPLATE_DIR/migrations" 2>/dev/null)" ]; then
    echo "Copying migrations from template..."
    mkdir -p "$DATA_DIR/migrations"
    cp -r "$TEMPLATE_DIR/migrations"/* "$DATA_DIR/migrations/"
    echo "Migrations copied successfully."
else
    echo "Warning: No migrations found in template directory: $TEMPLATE_DIR/migrations"
fi

# Create secrets directory
SECRETS_DIR="$DATA_DIR/secrets"
mkdir -p "$SECRETS_DIR"

# Generate config and vault files from template
CONFIG_FILE="$DATA_DIR/config.textproto"
VAULT_FILE="$SECRETS_DIR/secrets.textproto"
echo "Generating config and vault files from template..."
if ! "$CONFIG_GENERATOR_BINARY" "$CONFIG_TEMPLATE" "$AUTHN_FILE" "$CONFIG_FILE" "$VAULT_FILE"; then
    echo "Error: Failed to generate config and vault files"
    exit 1
fi

# Verify generated config
if ! grep -q 'site_url: "http://localhost:7000"' "$CONFIG_FILE"; then
    echo "Error: site_url not found in generated config"
    exit 1
fi

if ! grep -q "oauth_providers:" "$CONFIG_FILE"; then
    echo "Error: OAuth configuration not found in generated config"
    exit 1
fi

if ! grep -q "record_apis:" "$CONFIG_FILE"; then
    echo "Error: Record API configuration not found in generated config"
    exit 1
fi

# Verify config has OAuth client ID (should be actual value, not <REDACTED>)
if grep -q 'client_id: "<REDACTED>"' "$CONFIG_FILE"; then
    echo "Error: OAuth client ID not properly set in config file (still has <REDACTED> placeholder)"
    exit 1
fi

if ! grep -q 'client_id: "' "$CONFIG_FILE"; then
    echo "Error: OAuth client ID not found in config file"
    exit 1
fi

# Verify config has <REDACTED> placeholder for client secret (secret is in vault)
if ! grep -q 'client_secret: "<REDACTED>"' "$CONFIG_FILE"; then
    echo "Error: OAuth client secret placeholder not found in generated config"
    exit 1
fi

# Verify vault file was created
if [ ! -f "$VAULT_FILE" ]; then
    echo "Error: Vault file not found: $VAULT_FILE"
    exit 1
fi

# Verify vault file contains client secret (client ID is in config, not vault)
if ! grep -q "TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_SECRET" "$VAULT_FILE"; then
    echo "Error: OAuth client secret not found in vault file"
    exit 1
fi

# Verify vault file does NOT contain client ID (it should be in config, not vault)
if grep -q "TRAIL_AUTH_OAUTH_PROVIDERS_GOOGLE_CLIENT_ID" "$VAULT_FILE"; then
    echo "Error: OAuth client ID should not be in vault file (it should be in config file)"
    exit 1
fi

echo "Config and vault files generated successfully."

echo ""
echo "Starting TrailBase server..."
echo "Data directory: $DATA_DIR"
echo "Admin dashboard: http://localhost:7000/_/admin/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run TrailBase server
"$TRAIL_BINARY" --data-dir="$DATA_DIR" run --address=0.0.0.0:7000 --dev
