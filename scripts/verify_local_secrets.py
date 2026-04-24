#!/usr/bin/env python3
"""Verify local Supabase and OpenAI credentials without printing secrets."""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"

REQUIRED_VARS = (
    "OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_DB_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
)


def load_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            values[key] = value
    return values


def get_config() -> dict[str, str]:
    config = load_dotenv(ENV_FILE)
    for key in REQUIRED_VARS:
        env_value = os.environ.get(key)
        if env_value is not None:
            config[key] = env_value
    return config


def print_result(name: str, ok: bool, reason: str) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"{status} {name}: {reason}")


def check(name: str, fn: Callable[[], tuple[bool, str]]) -> bool:
    try:
        ok, reason = fn()
    except Exception as exc:  # Keep unexpected failures secret-safe.
        ok, reason = False, f"unexpected {exc.__class__.__name__}"
    print_result(name, ok, reason)
    return ok


def request_json_or_text(
    url: str,
    headers: dict[str, str],
    timeout: int = 15,
) -> tuple[int, str]:
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read(256).decode("utf-8", errors="replace")
            return response.status, body
    except urllib.error.HTTPError as exc:
        body = exc.read(256).decode("utf-8", errors="replace")
        return exc.code, body


def decode_jwt_payload(token: str) -> dict[str, object]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("invalid JWT format")
    payload = parts[1]
    padding = "=" * (-len(payload) % 4)
    decoded = base64.urlsafe_b64decode(payload + padding)
    return json.loads(decoded)


def make_checks(config: dict[str, str]) -> list[tuple[str, Callable[[], tuple[bool, str]]]]:
    def require(*keys: str) -> str | None:
        missing = [key for key in keys if not config.get(key)]
        if missing:
            return "missing " + ", ".join(missing)
        return None

    def required_vars() -> tuple[bool, str]:
        missing = [key for key in REQUIRED_VARS if not config.get(key)]
        if missing:
            return False, "missing " + ", ".join(missing)
        return True, "all required variables found"

    def supabase_url_matches_ref() -> tuple[bool, str]:
        missing = require("SUPABASE_URL", "SUPABASE_PROJECT_REF")
        if missing:
            return False, missing
        supabase_url = config.get("SUPABASE_URL", "")
        project_ref = config.get("SUPABASE_PROJECT_REF", "")
        parsed = urlparse(supabase_url)
        host = parsed.hostname or ""
        if parsed.scheme != "https":
            return False, "SUPABASE_URL must use https"
        if not project_ref:
            return False, "SUPABASE_PROJECT_REF missing"
        if host == f"{project_ref}.supabase.co":
            return True, "project ref matches Supabase URL"
        return False, "SUPABASE_URL host does not match project ref"

    def service_role_jwt() -> tuple[bool, str]:
        missing = require("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PROJECT_REF")
        if missing:
            return False, missing
        payload = decode_jwt_payload(config.get("SUPABASE_SERVICE_ROLE_KEY", ""))
        role = payload.get("role")
        ref = payload.get("ref")
        if role != "service_role":
            return False, "JWT role is not service_role"
        if ref != config.get("SUPABASE_PROJECT_REF"):
            return False, "JWT ref does not match project ref"
        return True, "service role JWT claims match"

    def supabase_anon_rest_and_auth() -> tuple[bool, str]:
        missing = require("SUPABASE_URL", "SUPABASE_ANON_KEY")
        if missing:
            return False, missing
        base_url = config.get("SUPABASE_URL", "").rstrip("/")
        anon_key = config.get("SUPABASE_ANON_KEY", "")
        auth_status, _ = request_json_or_text(
            f"{base_url}/auth/v1/settings",
            {
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
            },
        )
        if not (200 <= auth_status < 300):
            return False, f"anon auth endpoint returned HTTP {auth_status}"

        rest_status, _ = request_json_or_text(
            f"{base_url}/rest/v1/",
            {
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "Accept": "application/openapi+json",
            },
        )
        if not (200 <= rest_status < 300):
            return False, f"anon REST endpoint returned HTTP {rest_status}"
        return True, "anon auth and REST endpoints reachable"

    def supabase_service_rest() -> tuple[bool, str]:
        missing = require("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
        if missing:
            return False, missing
        base_url = config.get("SUPABASE_URL", "").rstrip("/")
        service_key = config.get("SUPABASE_SERVICE_ROLE_KEY", "")
        status, _ = request_json_or_text(
            f"{base_url}/rest/v1/",
            {
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Accept": "application/openapi+json",
            },
        )
        if 200 <= status < 300:
            return True, "service role REST endpoint reachable"
        return False, f"service role REST endpoint returned HTTP {status}"

    def supabase_db_connection() -> tuple[bool, str]:
        missing = require("SUPABASE_DB_URL")
        if missing:
            return False, missing
        db_url = config.get("SUPABASE_DB_URL", "")
        try:
            import psycopg
        except ImportError:
            psycopg = None

        if psycopg is not None:
            with psycopg.connect(db_url, connect_timeout=15) as conn:
                with conn.cursor() as cur:
                    cur.execute("select 1")
                    cur.fetchone()
            return True, "PostgreSQL connection succeeded"

        try:
            import psycopg2
        except ImportError:
            return False, "install psycopg or psycopg2 to test PostgreSQL"

        conn = psycopg2.connect(db_url, connect_timeout=15)
        try:
            with conn.cursor() as cur:
                cur.execute("select 1")
                cur.fetchone()
        finally:
            conn.close()
        return True, "PostgreSQL connection succeeded"

    def openai_models() -> tuple[bool, str]:
        missing = require("OPENAI_API_KEY")
        if missing:
            return False, missing
        api_key = config.get("OPENAI_API_KEY", "")
        status, _ = request_json_or_text(
            "https://api.openai.com/v1/models",
            {
                "Authorization": f"Bearer {api_key}",
            },
        )
        if 200 <= status < 300:
            return True, "OpenAI models endpoint reachable"
        return False, f"OpenAI models endpoint returned HTTP {status}"

    return [
        ("required variables", required_vars),
        ("Supabase URL/ref", supabase_url_matches_ref),
        ("Supabase service role JWT", service_role_jwt),
        ("Supabase anon REST/auth", supabase_anon_rest_and_auth),
        ("Supabase service REST", supabase_service_rest),
        ("Supabase DB URL", supabase_db_connection),
        ("OpenAI API key", openai_models),
    ]


def main() -> int:
    config = get_config()
    results = [check(name, fn) for name, fn in make_checks(config)]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
