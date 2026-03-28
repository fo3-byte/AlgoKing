"""
Fyers Auto Login — generates access token using TOTP
No manual login needed. Run daily before market open.

Usage: python3 fyers_auto_login.py
"""

import base64
import hashlib
import hmac
import struct
import time
import json
import os
from urllib.parse import urlparse, parse_qs
import requests

# ── Credentials ──
CLIENT_ID = os.environ.get("FYERS_APP_ID", "N7XLPBFRN3-100")
SECRET_KEY = os.environ.get("FYERS_SECRET", "31M0CUUMSZ")
REDIRECT_URI = os.environ.get("FYERS_REDIRECT", "https://algomaster-pro.vercel.app/api/fyers-auth")
FY_ID = os.environ.get("FYERS_FY_ID", "FAD25830")
PIN = os.environ.get("FYERS_PIN", "1503")
TOTP_KEY = os.environ.get("FYERS_TOTP_KEY", "BO2YDQMFWO73PRTAGBSFEONWASJ6QXZH")


def generate_totp(key, time_step=30, digits=6):
    """Generate TOTP code from secret key."""
    key_bytes = base64.b32decode(key.upper() + "=" * ((8 - len(key)) % 8))
    counter = struct.pack(">Q", int(time.time() / time_step))
    mac = hmac.new(key_bytes, counter, "sha1").digest()
    offset = mac[-1] & 0x0F
    binary = struct.unpack(">L", mac[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(binary)[-digits:].zfill(digits)


def get_access_token():
    """Full automated login flow: OTP → TOTP verify → PIN verify → Auth code → Access token."""

    s = requests.Session()
    s.headers.update({
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json",
    })

    # Step 1: Send login OTP
    print("Step 1: Sending login OTP...")
    fy_id_b64 = base64.b64encode(FY_ID.encode()).decode()
    r1 = s.post(
        "https://api-t2.fyers.in/vagator/v2/send_login_otp_v2",
        json={"fy_id": fy_id_b64, "app_id": "2"}
    )
    if r1.status_code != 200:
        print(f"  Failed: {r1.status_code} {r1.text}")
        return None
    request_key = r1.json().get("request_key")
    print(f"  OK — request_key: {request_key[:20]}...")

    # Step 2: Verify TOTP
    print("Step 2: Verifying TOTP...")
    totp_code = generate_totp(TOTP_KEY)
    print(f"  Generated TOTP: {totp_code}")
    r2 = s.post(
        "https://api-t2.fyers.in/vagator/v2/verify_otp",
        json={"request_key": request_key, "otp": int(totp_code)}
    )
    if r2.status_code != 200:
        print(f"  Failed: {r2.status_code} {r2.text}")
        return None
    request_key = r2.json().get("request_key")
    print(f"  OK — new request_key: {request_key[:20]}...")

    # Step 3: Verify PIN
    print("Step 3: Verifying PIN...")
    pin_b64 = base64.b64encode(PIN.encode()).decode()
    r3 = s.post(
        "https://api-t2.fyers.in/vagator/v2/verify_pin_v2",
        json={"request_key": request_key, "identity_type": "pin", "identifier": pin_b64}
    )
    if r3.status_code != 200:
        print(f"  Failed: {r3.status_code} {r3.text}")
        return None
    bearer_token = r3.json().get("data", {}).get("access_token")
    print(f"  OK — bearer token: {bearer_token[:20]}...")

    # Step 4: Get auth code (v3 endpoint)
    print("Step 4: Getting auth code...")
    app_id_short = CLIENT_ID[:-4]  # Remove -100
    r4 = s.post(
        "https://api-t1.fyers.in/api/v3/token",
        headers={
            "authorization": f"Bearer {bearer_token}",
            "content-type": "application/json; charset=UTF-8",
        },
        json={
            "fyers_id": FY_ID,
            "app_id": app_id_short,
            "redirect_uri": REDIRECT_URI,
            "appType": "100",
            "code_challenge": "",
            "state": "auto_login",
            "scope": "",
            "nonce": "",
            "response_type": "code",
            "create_cookie": True,
        }
    )
    if r4.status_code not in (200, 308):
        print(f"  Status: {r4.status_code}, Response: {r4.text[:200]}")
        # Try alternate endpoint
        r4 = s.post(
            "https://api.fyers.in/api/v3/token",
            headers={
                "authorization": f"Bearer {bearer_token}",
                "content-type": "application/json; charset=UTF-8",
            },
            json={
                "fyers_id": FY_ID,
                "app_id": app_id_short,
                "redirect_uri": REDIRECT_URI,
                "appType": "100",
                "code_challenge": "",
                "state": "auto_login",
                "scope": "",
                "nonce": "",
                "response_type": "code",
                "create_cookie": True,
            }
        )
        if r4.status_code not in (200, 308):
            print(f"  Alternate also failed: {r4.status_code} {r4.text[:200]}")
            return None

    resp_json = r4.json()
    url = resp_json.get("Url", resp_json.get("url", ""))
    parsed = urlparse(url)
    auth_code = parse_qs(parsed.query).get("auth_code", [None])[0]
    if not auth_code:
        print(f"  Failed to extract auth_code from: {url}")
        return None
    print(f"  OK — auth_code: {auth_code[:30]}...")

    # Step 5: Generate access token
    print("Step 5: Generating access token...")
    app_hash = hashlib.sha256(f"{CLIENT_ID}:{SECRET_KEY}".encode()).hexdigest()
    r5 = requests.post(
        "https://api-t1.fyers.in/api/v3/validate-authcode",
        json={
            "grant_type": "authorization_code",
            "appIdHash": app_hash,
            "code": auth_code,
        }
    )
    resp = r5.json()
    if resp.get("access_token"):
        token = resp["access_token"]
        full_token = f"{CLIENT_ID}:{token}"
        print(f"\n✅ Access token generated successfully!")
        print(f"   Token: {full_token[:50]}...")
        return full_token
    else:
        print(f"  Failed: {resp}")
        return None


def update_vercel_env(token):
    """Update FYERS_ACCESS_TOKEN on Vercel (requires vercel CLI)."""
    import subprocess
    try:
        result = subprocess.run(
            ["npx", "vercel", "env", "add", "FYERS_ACCESS_TOKEN", "production", "--force"],
            input=token.encode(),
            capture_output=True,
            cwd=os.path.join(os.path.dirname(__file__), "dashboard"),
            timeout=30,
        )
        if result.returncode == 0:
            print("✅ Vercel env updated!")
            # Redeploy
            subprocess.run(
                ["npx", "vercel", "--yes", "--prod"],
                capture_output=True,
                cwd=os.path.join(os.path.dirname(__file__), "dashboard"),
                timeout=120,
            )
            print("✅ Redeployed!")
        else:
            print(f"⚠️  Vercel update failed: {result.stderr.decode()}")
    except Exception as e:
        print(f"⚠️  Could not update Vercel: {e}")


if __name__ == "__main__":
    print("🔐 Fyers Auto Login\n")
    token = get_access_token()
    if token:
        # Save locally
        env_path = os.path.join(os.path.dirname(__file__), "dashboard", ".env.local")
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                content = f.read()
            if "FYERS_ACCESS_TOKEN=" in content:
                lines = content.split("\n")
                lines = [l for l in lines if not l.startswith("FYERS_ACCESS_TOKEN=")]
                content = "\n".join(lines)
            content += f"\nFYERS_ACCESS_TOKEN={token}\n"
            with open(env_path, "w") as f:
                f.write(content)
            print(f"✅ Saved to {env_path}")

        # Update Vercel
        update_vercel_env(token)
    else:
        print("\n❌ Failed to generate token")
