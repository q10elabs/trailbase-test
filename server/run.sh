#!/bin/bash

# Script to run TrailBase server for the counter experiment
# Usage: ./run.sh <traildepot-directory>
# Example: ./run.sh /tmp/trailbase-test
#
# Assumes the traildepot directory was initialized with run-fresh.sh

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAILBASE_DIR="$SCRIPT_DIR/../trailbase"
TRAIL_BINARY="$TRAILBASE_DIR/target/x86_64-unknown-linux-gnu/release/trail"

# Get traildepot directory from argument
if [ -z "$1" ]; then
    echo "Usage: $0 <traildepot-directory>"
    echo "Example: $0 /tmp/trailbase-test"
    echo ""
    echo "Note: The traildepot directory should be initialized with run-fresh.sh"
    exit 1
fi

DATA_DIR="$1"

# Check if TrailBase binary exists
if [ ! -f "$TRAIL_BINARY" ]; then
    echo "Error: TrailBase binary not found at $TRAIL_BINARY"
    echo "Please build it first by running: cd $TRAILBASE_DIR && make static"
    exit 1
fi

# Check if traildepot directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo "Error: Traildepot directory not found: $DATA_DIR"
    echo "Please initialize it first with: ./run-fresh.sh $DATA_DIR"
    exit 1
fi

# Check if config file exists (indicates initialization)
CONFIG_FILE="$DATA_DIR/config.textproto"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found in $DATA_DIR"
    echo "The directory doesn't appear to be initialized."
    echo "Please initialize it first with: ./run-fresh.sh $DATA_DIR"
    exit 1
fi

# Run TrailBase server
echo "Starting TrailBase server..."
echo "Data directory: $DATA_DIR"
echo "Admin dashboard: http://localhost:7000/_/admin/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

"$TRAIL_BINARY" --data-dir="$DATA_DIR" run --address=0.0.0.0:7000 --dev
