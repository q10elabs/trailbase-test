#!/usr/bin/env python3
"""
TrailBase Authentication Test Script

Tests the TrailBase Admin API and Auth API by:
1. Logging in as admin user
2. Creating a test user via Admin API
3. Logging in with that test user
4. Displaying all authentication details

Usage:
    python3 test_auth.py <server-url> --admin-email EMAIL --admin-password PASSWORD

Example:
    python3 test_auth.py http://localhost:7000 --admin-email admin@localhost --admin-password your_password
"""

import argparse
import sys
import json
import base64
import secrets
import string
from datetime import datetime
from typing import Dict, Any, Tuple, Optional

try:
    import requests
except ImportError:
    print("Error: 'requests' library not found.", file=sys.stderr)
    print("Install it with: pip install requests", file=sys.stderr)
    sys.exit(1)


def generate_random_string(length: int = 8) -> str:
    """Generate a random alphanumeric string."""
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def create_user(
    base_url: str,
    email: str,
    password: str,
    auth_token: str,
    csrf_token: str
) -> Dict[str, Any]:
    """
    Create a test user via TrailBase Admin API.

    Args:
        base_url: Base URL of TrailBase server
        email: User email
        password: User password
        auth_token: Admin user's JWT token
        csrf_token: CSRF token from admin user's JWT

    Returns:
        Response JSON containing user ID

    Raises:
        requests.HTTPError: If request fails
    """
    url = f"{base_url}/api/_admin/user"

    payload = {
        "email": email,
        "password": password,
        "verified": True,  # Skip email verification
        "admin": False
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}",
        "CSRF-Token": csrf_token
    }

    response = requests.post(url, json=payload, headers=headers)

    response.raise_for_status()
    return response.json()


def login(base_url: str, email: str, password: str) -> Dict[str, Any]:
    """
    Login to TrailBase and get authentication tokens.

    Args:
        base_url: Base URL of TrailBase server
        email: User email
        password: User password

    Returns:
        Response JSON containing auth_token, refresh_token, csrf_token

    Raises:
        requests.HTTPError: If request fails
    """
    url = f"{base_url}/api/auth/v1/login"

    payload = {
        "email": email,
        "password": password
    }

    response = requests.post(
        url,
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    response.raise_for_status()
    return response.json()


def decode_jwt_payload(token: str) -> Dict[str, Any]:
    """
    Decode JWT token payload (without verification).

    Args:
        token: JWT token string

    Returns:
        Decoded payload as dictionary
    """
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")

        # Decode payload (second part)
        # Add padding if needed
        payload_b64 = parts[1]
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += '=' * padding

        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload_json = payload_bytes.decode('utf-8')

        return json.loads(payload_json)
    except Exception as e:
        return {"error": f"Failed to decode JWT: {str(e)}"}


def format_timestamp(unix_timestamp: int) -> str:
    """Format Unix timestamp as human-readable datetime."""
    try:
        dt = datetime.fromtimestamp(unix_timestamp)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return str(unix_timestamp)


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Test TrailBase authentication APIs'
    )
    parser.add_argument(
        'server_url',
        help='TrailBase server URL (e.g., http://localhost:7000)'
    )
    parser.add_argument(
        '--admin-email',
        required=True,
        help='Admin user email'
    )
    parser.add_argument(
        '--admin-password',
        required=True,
        help='Admin user password'
    )

    args = parser.parse_args()
    base_url = args.server_url.rstrip('/')

    # Generate random test user credentials
    random_id = generate_random_string(6)
    test_email = f"test-{random_id}@example.com"
    test_password = f"secure-{generate_random_string(8)}"

    print_section("TrailBase Authentication Test")
    print(f"Server: {base_url}")

    # Step 1: Login as admin
    print_section("Step 1: Login as Admin")
    print(f"  Email:    {args.admin_email}")
    print(f"  Password: {'*' * len(args.admin_password)}")

    try:
        admin_login_response = login(base_url, args.admin_email, args.admin_password)

        admin_auth_token = admin_login_response.get('auth_token', '')
        admin_csrf_token = admin_login_response.get('csrf_token', '')

        print(f"\n✓ Admin login successful!")
        print(f"  Auth Token:  {admin_auth_token[:50]}...")
        print(f"  CSRF Token:  {admin_csrf_token}")

    except requests.exceptions.RequestException as e:
        print(f"\n✗ Admin login failed!", file=sys.stderr)
        print(f"  Error: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.text
                print(f"  Response: {error_detail}", file=sys.stderr)
            except:
                pass
        print(f"\nHint: Make sure the admin user exists with correct credentials.", file=sys.stderr)
        sys.exit(1)

    # Step 2: Create test user
    print_section("Step 2: Creating Test User")
    print(f"  Email:    {test_email}")
    print(f"  Password: {test_password}")

    try:
        user_response = create_user(
            base_url,
            test_email,
            test_password,
            admin_auth_token,
            admin_csrf_token
        )
        user_id = user_response.get('id', 'N/A')

        print(f"\n✓ User created successfully!")
        print(f"  User ID: {user_id}")

    except requests.exceptions.RequestException as e:
        print(f"\n✗ Failed to create user!", file=sys.stderr)
        print(f"  Error: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.text
                print(f"  Response: {error_detail}", file=sys.stderr)
            except:
                pass
        sys.exit(1)

    # Step 3: Login as test user
    print_section("Step 3: Login as Test User")

    try:
        login_response = login(base_url, test_email, test_password)

        auth_token = login_response.get('auth_token', '')
        refresh_token = login_response.get('refresh_token', '')
        csrf_token = login_response.get('csrf_token', '')

        print(f"✓ Login successful!")
        print(f"\n  Auth Token (JWT):    {auth_token[:50]}...")
        print(f"  Refresh Token:       {refresh_token[:50]}...")
        print(f"  CSRF Token:          {csrf_token}")

    except requests.exceptions.RequestException as e:
        print(f"\n✗ Login failed!", file=sys.stderr)
        print(f"  Error: {e}", file=sys.stderr)
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.text
                print(f"  Response: {error_detail}", file=sys.stderr)
            except:
                pass
        sys.exit(1)

    # Step 4: Decode JWT
    print_section("Step 4: Decoded JWT Claims")

    jwt_payload = decode_jwt_payload(auth_token)

    if 'error' in jwt_payload:
        print(f"⚠ Warning: {jwt_payload['error']}")
    else:
        # Pretty print with explanations
        print(json.dumps(jwt_payload, indent=2))

        # Add human-readable timestamps
        if 'iat' in jwt_payload:
            print(f"\n  Issued At:  {format_timestamp(jwt_payload['iat'])}")
        if 'exp' in jwt_payload:
            print(f"  Expires At: {format_timestamp(jwt_payload['exp'])}")

            # Calculate time until expiration
            now = datetime.now().timestamp()
            exp = jwt_payload['exp']
            if exp > now:
                minutes_left = int((exp - now) / 60)
                print(f"  Valid For:  {minutes_left} minutes")
            else:
                print(f"  Status:     EXPIRED")

    # Step 5: Summary
    print_section("Summary")
    print(f"✓ Admin Login:   {args.admin_email}")
    print(f"✓ User Created:  {test_email}")
    print(f"✓ User ID:       {user_id}")
    print(f"✓ User Login:    SUCCESS")
    print(f"✓ Tokens:        auth_token, refresh_token, csrf_token")
    print()

    # Success
    print("=" * 60)
    print("  ✓ Authentication test completed successfully!")
    print("=" * 60)
    print()

    sys.exit(0)


if __name__ == '__main__':
    main()
