"""
Dhan Auto Login — generates access token using TOTP + PIN
No manual login needed. Run daily before market open.

Usage: python3 dhan_auto_login.py

Requires: pip install dhanhq pyotp
"""

import os
import sys
import json
import time
import struct
import hmac
import base64
import requests

# ── Credentials (set via env vars or edit defaults) ──────────────────────

DHAN_CLIENT_ID = os.environ.get("DHAN_CLIENT_ID", "b1e4d838")
DHAN_PIN = os.environ.get("DHAN_PIN", "")         # Your 6-digit PIN
DHAN_TOTP_SECRET = os.environ.get("DHAN_TOTP_SECRET", "")  # TOTP secret from Dhan setup


def generate_totp(secret, time_step=30, digits=6):
    """Generate TOTP code from secret key (RFC 6238)."""
    # Pad base32 secret
    padded = secret.upper() + "=" * ((8 - len(secret) % 8) % 8)
    key_bytes = base64.b32decode(padded)
    counter = struct.pack(">Q", int(time.time() / time_step))
    mac = hmac.new(key_bytes, counter, "sha1").digest()
    offset = mac[-1] & 0x0F
    binary = struct.unpack(">L", mac[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(binary)[-digits:].zfill(digits)


def get_access_token_via_sdk():
    """Method 1: Use official DhanHQ SDK (recommended)."""
    try:
        from dhanhq import DhanLogin
        print("Using DhanHQ SDK...")

        totp_code = generate_totp(DHAN_TOTP_SECRET)
        print(f"  Generated TOTP: {totp_code}")

        dhan_login = DhanLogin(DHAN_CLIENT_ID)
        result = dhan_login.generate_token(DHAN_PIN, totp_code)

        if isinstance(result, dict) and result.get("accessToken"):
            token = result["accessToken"]
            print(f"\n✅ Access token generated via SDK!")
            print(f"   Token: {token[:40]}...")
            print(f"   Expires: {result.get('expiryTime', 'unknown')}")
            return token
        else:
            print(f"  SDK returned: {result}")
            return None
    except ImportError:
        print("  dhanhq not installed, trying direct API...")
        return None
    except Exception as e:
        print(f"  SDK error: {e}, trying direct API...")
        return None


def get_access_token_via_api():
    """Method 2: Direct API call (fallback)."""
    print("Using direct API...")

    totp_code = generate_totp(DHAN_TOTP_SECRET)
    print(f"  Generated TOTP: {totp_code}")

    # Dhan auth endpoint
    url = "https://auth.dhan.co/app/generateAccessToken"

    payload = {
        "dhanClientId": DHAN_CLIENT_ID,
        "pin": DHAN_PIN,
        "totp": totp_code,
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    }

    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        print(f"  Status: {r.status_code}")

        if r.status_code == 200:
            data = r.json()
            token = data.get("accessToken") or data.get("access_token")
            if token:
                print(f"\n✅ Access token generated via API!")
                print(f"   Token: {token[:40]}...")
                print(f"   Expires: {data.get('expiryTime', 'unknown')}")
                return token
            else:
                print(f"  Response: {json.dumps(data, indent=2)}")
                return None
        else:
            print(f"  Failed: {r.text[:300]}")
            return None
    except Exception as e:
        print(f"  Error: {e}")
        return None


def save_token_locally(token):
    """Save token to dashboard .env.local file."""
    env_path = os.path.join(os.path.dirname(__file__), "dashboard", ".env.local")

    # Read existing content
    content = ""
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            content = f.read()

    # Remove old DHAN tokens
    lines = content.split("\n")
    lines = [l for l in lines if not l.startswith("DHAN_ACCESS_TOKEN=") and not l.startswith("DHAN_CLIENT_ID=")]
    content = "\n".join(lines).rstrip()

    # Add new tokens
    content += f"\nDHAN_ACCESS_TOKEN={token}\n"
    content += f"DHAN_CLIENT_ID={DHAN_CLIENT_ID}\n"

    with open(env_path, "w") as f:
        f.write(content)

    print(f"✅ Saved to {env_path}")


def push_token_to_dashboard(token):
    """Push token to the running dashboard's /api/dhan endpoint."""
    urls = [
        "http://localhost:3000/api/dhan",  # Local dev
        "https://algomaster-pro.vercel.app/api/dhan",  # Production
    ]

    for url in urls:
        try:
            r = requests.post(url, json={
                "action": "set-token",
                "accessToken": token,
                "clientId": DHAN_CLIENT_ID,
            }, timeout=10)

            if r.status_code == 200:
                data = r.json()
                if data.get("connected"):
                    print(f"✅ Token pushed to {url}")
                else:
                    print(f"⚠️  Push to {url}: {data}")
            else:
                print(f"⚠️  Push to {url}: HTTP {r.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"  Skipped {url} (not running)")
        except Exception as e:
            print(f"  Error pushing to {url}: {e}")


def main():
    print("🔐 Dhan Auto Login")
    print(f"   Client ID: {DHAN_CLIENT_ID}")
    print()

    # Validate credentials
    if not DHAN_PIN:
        print("❌ DHAN_PIN not set. Set via:")
        print("   export DHAN_PIN='your-6-digit-pin'")
        sys.exit(1)

    if not DHAN_TOTP_SECRET:
        print("❌ DHAN_TOTP_SECRET not set. Set via:")
        print("   export DHAN_TOTP_SECRET='your-totp-secret-from-dhan-setup'")
        sys.exit(1)

    # Try SDK first, then direct API
    token = get_access_token_via_sdk()
    if not token:
        token = get_access_token_via_api()

    if token:
        print()
        save_token_locally(token)
        push_token_to_dashboard(token)
        print("\n🎯 Done! Dhan is ready for trading.")
        print(f"   Token valid for ~24 hours from now.")
        print(f"\n   To auto-run daily, add to crontab:")
        print(f"   0 8 * * 1-5 cd {os.path.dirname(os.path.abspath(__file__))} && python3 dhan_auto_login.py")
    else:
        print("\n❌ Failed to generate token. Check credentials.")
        sys.exit(1)


if __name__ == "__main__":
    main()
