# TrailBase Server Setup

This directory contains the TrailBase server deployment for the counter experiment.

## Prerequisites

- TrailBase binary built from source (run `make static` in the `trailbase/` directory)
- The binary will be at: `../trailbase/target/x86_64-unknown-linux-gnu/release/trail`

## Setup

1. Build TrailBase (if not already built):
   ```bash
   cd ../trailbase
   make static
   cd ../server
   ```

2. Run the server:
   
   **Option A: Fresh initialization and run (reinitializes directory each time):**
   ```bash
   ./run-fresh.sh /tmp/trailbase-test
   ```
   This script:
   - Removes the specified directory if it exists
   - Creates a fresh traildepot directory
   - Copies migrations from `template/migrations/` directory
   - Generates config from template using Rust config generator
   - Starts the server (which runs migrations and uses the generated config)
   
   Useful for testing and reproducibility - each run starts with a clean state.
   
   **Option B: Run existing traildepot (assumes already initialized):**
   ```bash
   ./run.sh /tmp/trailbase-test
   ```
   This script:
   - Takes the traildepot directory as an argument
   - Assumes the directory was initialized with `run-fresh.sh`
   - Simply starts the TrailBase server
   
   **Template Directory**: The `template/` directory contains the reproducible configuration:
   - `template/migrations/` - SQL migration files that create the database schema
   - `template/config.textproto.template` - Config template with placeholders
   - `template/config-generator/` - Rust program that generates config from template

   **Or manually:**
   ```bash
   ../trailbase/target/x86_64-unknown-linux-gnu/release/trail --data-dir=/path/to/traildepot run --address=0.0.0.0:7000 --dev
   ```

3. On first run, TrailBase will:
   - Create the `traildepot/` directory
   - Create an admin user and print credentials to the terminal
   - Apply migrations from `traildepot/migrations/`

**Note**: If you've run the server before and need to update the schema, see [MIGRATION_UPDATE.md](./MIGRATION_UPDATE.md) for instructions.

4. Access the admin dashboard at: http://localhost:7000/_/admin/

## Configuration

- Server runs on `localhost:7000` by default
- Data directory: `traildepot/`
- Migrations: `traildepot/migrations/`
- Configuration: `traildepot/config.textproto` (auto-generated, can be edited)

## Database Schema

The `user_counters` table is created via migration:
- `id` (INTEGER PRIMARY KEY)
- `user` (BLOB, FOREIGN KEY to `_user.id` - stores UUID as BLOB)
- `counter_value` (INTEGER NOT NULL DEFAULT 0)

**Note**: The `user` column is BLOB type to match `_user.id` which stores UUIDs as BLOB. The client passes the user ID as a base64-encoded UUID string, and TrailBase automatically converts it to BLOB when inserting.

## Record API Configuration

**Important**: After first run, you need to configure the Record API. See [CONFIGURATION.md](./CONFIGURATION.md) for detailed instructions.

The `counters` Record API should be configured to:
- Allow authenticated users to READ, CREATE, UPDATE their own counters
- Enforce access control: users can only access records where `user = _USER_.id`

You can configure it via:
1. Admin dashboard (recommended): http://localhost:7000/_/admin/ → Tables → user_counters → Record API
2. Manual config file edit: See CONFIGURATION.md
