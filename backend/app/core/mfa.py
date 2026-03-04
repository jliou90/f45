from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time


def generate_base32_secret(length: int = 32) -> str:
    # Use RFC 3548 base32 alphabet (A-Z2-7), no padding.
    raw = secrets.token_bytes(max(20, length))
    return base64.b32encode(raw).decode("ascii").replace("=", "")[:length]


def _normalize_base32(secret: str) -> bytes:
    compact = "".join((secret or "").strip().upper().split())
    if not compact:
        raise ValueError("empty secret")
    pad = "=" * ((8 - (len(compact) % 8)) % 8)
    return base64.b32decode(compact + pad, casefold=True)


def _totp_at(secret: str, counter: int, digits: int = 6) -> str:
    key = _normalize_base32(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    off = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[off : off + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def verify_totp(secret: str, code: str, *, step_seconds: int = 30, window: int = 1) -> bool:
    normalized = "".join((code or "").strip().split())
    if not normalized.isdigit():
        return False
    now_counter = int(time.time() // step_seconds)
    for delta in range(-window, window + 1):
        if hmac.compare_digest(_totp_at(secret, now_counter + delta), normalized):
            return True
    return False


def current_totp(secret: str, *, step_seconds: int = 30) -> str:
    return _totp_at(secret, int(time.time() // step_seconds))


def provisioning_uri(*, account_name: str, issuer: str, secret: str) -> str:
    from urllib.parse import quote

    label = quote(f"{issuer}:{account_name}")
    params = f"secret={quote(secret)}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"
    return f"otpauth://totp/{label}?{params}"
