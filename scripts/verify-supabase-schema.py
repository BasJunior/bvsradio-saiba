#!/usr/bin/env python3
"""Verify BVS Supabase schema packs against production (service role).

Usage:
  python3 scripts/verify-supabase-schema.py --full
  python3 scripts/verify-supabase-schema.py --pack editorial --pack wallet
  python3 scripts/verify-supabase-schema.py --full --json

Env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

PACKS: dict[str, dict[str, Any]] = {
    "schema": {
        "step": 0,
        "file": "supabase-schema.sql",
        "tables": [
            "profiles",
            "tracks",
            "orders",
            "genres",
            "playlists",
            "playlist_tracks",
            "likes",
            "comments",
        ],
    },
    "library-sync": {
        "step": 1,
        "file": "supabase-library-sync.sql",
        "tables": ["user_library_items"],
    },
    "analytics": {
        "step": 2,
        "file": "supabase-analytics.sql",
        "tables": ["analytics_events"],
    },
    "editorial": {
        "step": 3,
        "file": "supabase-editorial-workflow.sql",
        "tables": [
            "editorial_staff",
            "editorial_audit_log",
            "track_credits",
            "track_review_requests",
            "programmes",
        ],
        "columns": {
            "tracks": [
                "editorial_status",
                "editorial_notes",
                "in_rotation",
                "is_public",
            ],
        },
    },
    "wallet": {
        "step": 4,
        "file": "supabase-artist-wallet-ledger.sql",
        "tables": [
            "artist_wallet_settings",
            "artist_deposits",
            "artist_ledger_entries",
            "artist_payout_methods",
            "artist_payout_requests",
            "artist_waitlist",
            "artist_onboarding_invites",
        ],
    },
    "releases": {
        "step": 5,
        "file": "supabase-releases-pipeline.sql",
        "tables": ["releases", "release_tracks", "distribution_jobs"],
        "columns": {
            "profiles": ["premium_active", "distribution_enabled"],
            "tracks": ["release_id", "track_number"],
        },
    },
    "creator": {
        "step": 6,
        "file": "supabase-creator-workflows.sql",
        "tables": [
            "writer_applications",
            "editorial_articles",
            "research_briefs",
            "show_creator_profiles",
            "show_episodes",
        ],
    },
    "community": {
        "step": 7,
        "file": "supabase-community-chat.sql",
        "tables": [
            "community_memberships",
            "live_chat_messages",
            "community_reports",
        ],
    },
    "final-sprint": {
        "step": 8,
        "file": "supabase-final-sprint-core.sql",
        "tables": ["track_play_events"],
        "columns": {
            "orders": [
                "customer_user_id",
                "tax_amount",
                "tax_rate",
                "stripe_session_id",
            ],
            "tracks": ["explicit_content"],
        },
        "rpcs": ["record_track_play"],
    },
}

ORDER = sorted(PACKS.keys(), key=lambda k: PACKS[k]["step"])


def env() -> tuple[str, str]:
    url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    return url, key


def rest(
    url: str, key: str, path: str, method: str = "GET", body: bytes | None = None
) -> tuple[int, Any]:
    req = urllib.request.Request(
        f"{url}{path}",
        data=body,
        method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "count=exact",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode()
            data = json.loads(raw) if raw else None
            return res.status, data
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()[:500]
        try:
            data = json.loads(raw)
        except Exception:
            data = raw
        return exc.code, data
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc)


def table_ok(url: str, key: str, table: str) -> tuple[str, str]:
    # select=1 limit 0 still hits schema/RLS; service role should pass if table exists
    code, data = rest(url, key, f"/rest/v1/{table}?select=*&limit=1")
    if code in (200, 206):
        return "OK", f"http {code}"
    if code == 404 or (
        isinstance(data, dict)
        and "Could not find the table" in json.dumps(data)
    ):
        return "MISSING", str(data)[:200]
    if code == 401 or code == 403:
        return "AUTH", str(data)[:200]
    # PostgREST PGRST205 = table not in schema cache / missing
    text = json.dumps(data) if not isinstance(data, str) else data
    if "PGRST205" in text or "does not exist" in text.lower():
        return "MISSING", text[:200]
    return "ERROR", f"http {code}: {text[:200]}"


def columns_ok(url: str, key: str, table: str, columns: list[str]) -> tuple[str, str]:
    select = ",".join(columns)
    code, data = rest(url, key, f"/rest/v1/{table}?select={select}&limit=1")
    if code in (200, 206):
        return "OK", f"cols {select}"
    text = json.dumps(data) if not isinstance(data, str) else data
    if code == 400 and (
        "column" in text.lower() or "PGRST204" in text or "does not exist" in text.lower()
    ):
        return "PARTIAL", text[:220]
    if code in (404,) or "PGRST205" in text:
        return "MISSING", text[:220]
    if code in (401, 403):
        return "AUTH", text[:220]
    return "ERROR", f"http {code}: {text[:220]}"


def rpc_ok(url: str, key: str, name: str) -> tuple[str, str]:
    # Call with invalid uuid should still prove function exists (not 404 schema)
    body = json.dumps({"p_track_id": "00000000-0000-0000-0000-000000000000", "p_source": "station"}).encode()
    code, data = rest(url, key, f"/rest/v1/rpc/{name}", method="POST", body=body)
    text = json.dumps(data) if not isinstance(data, str) else data
    if code in (200, 204):
        return "OK", f"http {code}"
    # FK violation / no row still means function exists
    if code in (400, 409) and (
        "foreign key" in text.lower()
        or "violates" in text.lower()
        or "PGRST202" not in text
    ):
        if "PGRST202" in text or "Could not find the function" in text:
            return "MISSING", text[:220]
        return "OK", f"callable http {code}"
    if "Could not find the function" in text or "PGRST202" in text:
        return "MISSING", text[:220]
    if code in (401, 403):
        return "AUTH", text[:220]
    return "ERROR", f"http {code}: {text[:220]}"


def check_pack(url: str, key: str, pack_id: str) -> dict[str, Any]:
    meta = PACKS[pack_id]
    results: list[dict[str, str]] = []
    worst = "OK"

    def bump(status: str) -> None:
        nonlocal worst
        rank = {"OK": 0, "PARTIAL": 1, "MISSING": 2, "ERROR": 3, "AUTH": 4}
        if rank.get(status, 0) > rank.get(worst, 0):
            worst = status

    for table in meta.get("tables") or []:
        status, detail = table_ok(url, key, table)
        results.append({"kind": "table", "name": table, "status": status, "detail": detail})
        bump(status)

    for table, cols in (meta.get("columns") or {}).items():
        status, detail = columns_ok(url, key, table, cols)
        results.append(
            {
                "kind": "columns",
                "name": f"{table}.({','.join(cols)})",
                "status": status,
                "detail": detail,
            }
        )
        bump(status)

    for rpc in meta.get("rpcs") or []:
        status, detail = rpc_ok(url, key, rpc)
        results.append({"kind": "rpc", "name": rpc, "status": status, "detail": detail})
        bump(status)

    return {
        "pack": pack_id,
        "step": meta["step"],
        "file": meta["file"],
        "status": worst,
        "checks": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify BVS Supabase schema packs")
    parser.add_argument("--full", action="store_true", help="Check all packs in order")
    parser.add_argument(
        "--pack",
        action="append",
        dest="packs",
        choices=list(PACKS.keys()),
        help="Pack id (repeatable)",
    )
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    url, key = env()
    if not url.startswith("http") or len(key) < 20:
        msg = (
            "ENV missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
            "(e.g. vercel env pull / vercel env run). Do not print secrets."
        )
        if args.json:
            print(json.dumps({"ok": False, "error": "ENV", "message": msg}))
        else:
            print("ENV FAIL")
            print(msg)
        return 2

    pack_ids = ORDER if args.full or not args.packs else args.packs
    # stable order
    pack_ids = sorted(set(pack_ids), key=lambda p: PACKS[p]["step"])

    report = {
        "url_host": url.split("//")[-1].split("/")[0],
        "packs": [check_pack(url, key, p) for p in pack_ids],
    }

    statuses = [p["status"] for p in report["packs"]]
    if any(s == "AUTH" for s in statuses):
        overall = "AUTH"
        code = 3
    elif any(s in ("MISSING", "PARTIAL", "ERROR") for s in statuses):
        overall = "NEEDS_APPLY"
        code = 1
    else:
        overall = "OK"
        code = 0
    report["overall"] = overall

    if args.json:
        print(json.dumps(report, indent=2))
        return code

    print(f"BVS schema verify · host={report['url_host']} · overall={overall}")
    print("Order: " + " → ".join(f"{PACKS[p]['step']}:{p}" for p in ORDER))
    print()
    for pack in report["packs"]:
        print(f"[{pack['step']}] {pack['pack']:14} {pack['status']:8}  file={pack['file']}")
        for c in pack["checks"]:
            if c["status"] != "OK":
                print(f"      - {c['kind']} {c['name']}: {c['status']} ({c['detail']})")
        if pack["status"] == "OK":
            print(f"      all {len(pack['checks'])} checks OK")
    print()
    if overall == "OK":
        print("Next: no SQL apply needed for checked packs. Run storage + auth URL checklist if not done.")
    elif overall == "NEEDS_APPLY":
        print("Next: apply MISSING/PARTIAL packs in step order using ops/SQL_APPLICATION_WORKFLOW.md")
        need = [p for p in report["packs"] if p["status"] != "OK"]
        for p in need:
            print(f"  → step {p['step']}: {p['file']}")
    else:
        print("Next: fix env / service role access, then re-run.")
    return code


if __name__ == "__main__":
    sys.exit(main())
