# TrailBase Authentication Test

This directory contains test utilities for TrailBase authentication.

## test_auth.py

Python script that tests the complete authentication flow:

1. **Admin Login**: Authenticates as an admin user
2. **User Creation**: Creates a new test user via Admin API
3. **User Login**: Authenticates as the newly created test user
4. **Token Display**: Shows and decodes all authentication tokens

### Requirements

```bash
pip install -r requirements.txt
```

### Usage

```bash
python3 test_auth.py <server-url> --admin-email EMAIL --admin-password PASSWORD
```

### Example

```bash
python3 test_auth.py http://localhost:7000 \
  --admin-email admin@localhost \
  --admin-password your_admin_password
```

### Output

The script displays:
- Admin login confirmation with auth token and CSRF token
- Created user details (email, password, user ID)
- Test user login tokens (auth_token, refresh_token, csrf_token)
- Decoded JWT claims with human-readable timestamps
- Summary of all operations

### Exit Codes

- **0**: Success
- **1**: Error (authentication failed, user creation failed, etc.)

### Notes

- Each run creates a new test user with random credentials
- The script requires an existing admin user in the TrailBase database
- Admin credentials must be provided via command-line arguments
- All tokens are displayed for inspection and debugging
