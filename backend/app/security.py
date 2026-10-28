import hashlib
import hmac
import secrets
from datetime import datetime, timedelta


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 210_000)
    return f"pbkdf2_sha256$210000${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    if password_hash == hashlib.sha256(password.encode("utf-8")).hexdigest():
        return True
    try:
        algorithm, rounds, salt, expected = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(rounds))
        return hmac.compare_digest(digest.hex(), expected)
    except (TypeError, ValueError):
        return False


def needs_password_rehash(password_hash: str | None) -> bool:
    if not password_hash:
        return True
    if len(password_hash) == 64 and all(char in "0123456789abcdef" for char in password_hash.lower()):
        return True
    if not password_hash.startswith("pbkdf2_sha256$"):
        return True
    try:
        _, rounds, _, _ = password_hash.split("$", 3)
    except ValueError:
        return True
    return int(rounds) < 210_000


def create_access_token() -> tuple[str, datetime]:
    return secrets.token_urlsafe(32), datetime.utcnow() + timedelta(hours=12)
