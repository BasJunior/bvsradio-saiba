#!/usr/bin/env python3
"""Apply BVS Supabase SQL packs as a BVS agent (no dashboard paste required).

Requires a Postgres connection string (service role REST cannot run DDL).

Credential sources (first match wins, never printed):
  1. env DATABASE_URL or SUPABASE_DB_URL
  2. ~/.openclaw/secrets/bvs-supabase-db.env
  3. repo .env.local / .env.vercel.production (if key present)

Usage:
  python3 scripts/apply-supabase-packs.py --status
  python3 scripts/apply-supabase-packs.py --apply-missing
  python3 scripts/apply-supabase-packs.py --pack editorial --pack wallet
  python3 scripts/apply-supabase-packs.py --apply-missing --dry-run
  python3 scripts/apply-supabase-packs.py --apply-missing --yes   # non-interactive

After apply, re-runs REST verify when SUPABASE_SERVICE_ROLE_KEY is available.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET_CANDIDATES = [
    Path.home() / ".openclaw/secrets/bvs-supabase-db.env",
    Path("/home/admin/.openclaw/secrets/bvs-supabase-db.env"),
    ROOT / ".env.local",
    ROOT / ".env.vercel.production",
    ROOT / ".env.vercel.pull",
]

# Canonical order — keep in sync with ops/SQL_APPLICATION_WORKFLOW.md
PACKS: list[dict[str, str | int]] = [
    {"id": "schema", "step": 0, "file": "supabase-schema.sql", "skip_if_table": "tracks"},
    {"id": "library-sync", "step": 1, "file": "supabase-library-sync.sql"},
    {"id": "analytics", "step": 2, "file": "supabase-analytics.sql"},
    {"id": "editorial", "step": 3, "file": "supabase-editorial-workflow.sql"},
    {"id": "wallet", "step": 4, "file": "supabase-artist-wallet-ledger.sql"},
    {"id": "releases", "step": 5, "file": "supabase-releases-pipeline.sql"},
    {"id": "creator", "step": 6, "file": "supabase-creator-workflows.sql"},
    {"id": "community", "step": 7, "file": "supabase-community-chat.sql"},
    {"id": "final-sprint", "step": 8, "file": "supabase-final-sprint-core.sql"},
    {"id": "beatstore-mvp", "step": 10, "file": "supabase-beatstore-mvp.sql", "skip_if_table": "beats"},
]

BOOKKEEPING_SQL = """
CREATE TABLE IF NOT EXISTS public.bvs_schema_packs (
  pack_id TEXT PRIMARY KEY,
  step INT NOT NULL,
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by TEXT NOT NULL DEFAULT 'bvs-agent'
);
"""


def load_dotenv_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if v and not re.search(r"^\[?SENSITIVE\]?$", v, re.I) and "your_" not in v.lower():
            out[k] = v
    return out


def hydrate_env() -> None:
    for path in SECRET_CANDIDATES:
        data = load_dotenv_file(path)
        for k, v in data.items():
            os.environ.setdefault(k, v)
        # common aliases
        if "SUPABASE_DB_URL" in data and "DATABASE_URL" not in os.environ:
            os.environ.setdefault("DATABASE_URL", data["SUPABASE_DB_URL"])
        if "POSTGRES_URL" in data and "DATABASE_URL" not in os.environ:
            os.environ.setdefault("DATABASE_URL", data["POSTGRES_URL"])
        if "POSTGRES_URL_NON_POOLING" in data and "DATABASE_URL" not in os.environ:
            os.environ.setdefault("DATABASE_URL", data["POSTGRES_URL_NON_POOLING"])


def db_url() -> str | None:
    for key in ("DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL_NON_POOLING", "POSTGRES_URL"):
        val = (os.environ.get(key) or "").strip()
        if val.startswith("postgres"):
            return val
    return None


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def connect():
    import psycopg2

    url = db_url()
    if not url:
        return None
    # Supabase pooler often needs sslmode
    if "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return psycopg2.connect(url, connect_timeout=30)


def table_exists(cur, name: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (name,),
    )
    return cur.fetchone() is not None


def ensure_bookkeeping(cur) -> None:
    cur.execute(BOOKKEEPING_SQL)


def applied_packs(cur) -> dict[str, str]:
    if not table_exists(cur, "bvs_schema_packs"):
        return {}
    cur.execute("SELECT pack_id, file_sha256 FROM public.bvs_schema_packs")
    return {row[0]: row[1] for row in cur.fetchall()}


def record_pack(cur, pack: dict, digest: str) -> None:
    cur.execute(
        """
        INSERT INTO public.bvs_schema_packs (pack_id, step, file_name, file_sha256, applied_by)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (pack_id) DO UPDATE SET
          step = EXCLUDED.step,
          file_name = EXCLUDED.file_name,
          file_sha256 = EXCLUDED.file_sha256,
          applied_at = NOW(),
          applied_by = EXCLUDED.applied_by
        """,
        (pack["id"], pack["step"], pack["file"], digest, "bvs-agent"),
    )


def run_sql_file(conn, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    # Execute as one script; files use IF NOT EXISTS and are intended re-runnable
    with conn.cursor() as cur:
        cur.execute(sql)


def status_report(conn) -> list[dict]:
    rows = []
    with conn.cursor() as cur:
        ensure_bookkeeping(cur)
        conn.commit()
        applied = applied_packs(cur)
        for pack in PACKS:
            path = ROOT / str(pack["file"])
            digest = sha256_file(path) if path.is_file() else ""
            skip_table = pack.get("skip_if_table")
            if skip_table and table_exists(cur, str(skip_table)) and pack["id"] not in applied:
                state = "SKIP_CORE_PRESENT"
            elif pack["id"] in applied:
                state = "APPLIED" if applied[pack["id"]] == digest else "STALE_FILE_CHANGED"
            else:
                state = "PENDING"
            rows.append(
                {
                    "id": pack["id"],
                    "step": pack["step"],
                    "file": pack["file"],
                    "state": state,
                    "sha256": digest[:12] if digest else "",
                }
            )
    return rows


def apply_pack(conn, pack: dict, dry_run: bool) -> str:
    path = ROOT / str(pack["file"])
    if not path.is_file():
        return f"ERROR missing file {path}"
    digest = sha256_file(path)
    with conn.cursor() as cur:
        ensure_bookkeeping(cur)
        skip_table = pack.get("skip_if_table")
        if skip_table and table_exists(cur, str(skip_table)):
            # still record so agents don't re-attempt heavy base schema
            if not dry_run:
                record_pack(cur, pack, digest)
                conn.commit()
            return "SKIPPED_CORE_PRESENT"
        if dry_run:
            return "WOULD_APPLY"
        try:
            run_sql_file(conn, path)
            record_pack(cur, pack, digest)
            conn.commit()
            return "APPLIED"
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            return f"ERROR {type(exc).__name__}: {exc}"


def rest_verify() -> int:
    """Optional REST verify if service role present."""
    if not (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY")):
        print("REST verify skipped (no service role env)")
        return 0
    script = ROOT / "scripts/verify-supabase-schema.py"
    if not script.is_file():
        return 0
    print("\n--- REST schema verify ---")
    proc = subprocess.run(
        [sys.executable, str(script), "--full"],
        cwd=str(ROOT),
        env=os.environ.copy(),
    )
    return proc.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="BVS agent SQL pack applier")
    parser.add_argument("--status", action="store_true", help="Show pack status only")
    parser.add_argument("--apply-missing", action="store_true", help="Apply PENDING/STALE packs in order")
    parser.add_argument("--pack", action="append", dest="packs", help="Apply specific pack id(s)")
    parser.add_argument("--dry-run", action="store_true", help="Do not execute SQL")
    parser.add_argument("--yes", action="store_true", help="Non-interactive confirm for agents")
    parser.add_argument("--no-verify", action="store_true", help="Skip REST verify after apply")
    args = parser.parse_args()

    hydrate_env()
    url = db_url()
    if not url:
        print("BLOCKED: no DATABASE_URL / SUPABASE_DB_URL")
        print("One-time setup for Abias (agents read this, never commit it):")
        print("  1. Supabase → Project Settings → Database → Connection string (URI)")
        print("     Prefer 'Direct' or 'Session' mode, not transaction pooler for DDL if issues.")
        print("  2. Write (mode 600):")
        print("     ~/.openclaw/secrets/bvs-supabase-db.env")
        print("     DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@...:5432/postgres")
        print("  3. Agent re-runs: python3 scripts/apply-supabase-packs.py --apply-missing --yes")
        return 2

    # never print URL (contains password)
    host = re.sub(r".*@", "", url.split("@")[-1]).split("/")[0] if "@" in url else "(hidden)"
    print(f"BVS SQL applier · db_host={host}")

    try:
        conn = connect()
    except Exception as exc:  # noqa: BLE001
        print(f"CONNECT FAIL: {type(exc).__name__}: {exc}")
        print("Check password, IP allowlist (allow VPS IP / 0.0.0.0 for agents), sslmode.")
        return 3

    assert conn is not None
    try:
        report = status_report(conn)
        print("\nPack status:")
        for row in report:
            print(f"  [{row['step']}] {row['id']:14} {row['state']:20} {row['file']}  sha={row['sha256']}")

        if args.status and not args.apply_missing and not args.packs:
            return 0

        targets: list[dict] = []
        if args.packs:
            wanted = set(args.packs)
            targets = [p for p in PACKS if p["id"] in wanted]
            missing = wanted - {p["id"] for p in targets}
            if missing:
                print("Unknown packs:", ", ".join(sorted(missing)))
                return 4
        elif args.apply_missing:
            state_by_id = {r["id"]: r["state"] for r in report}
            targets = [
                p
                for p in PACKS
                if state_by_id.get(str(p["id"])) in ("PENDING", "STALE_FILE_CHANGED")
            ]
        else:
            print("\nNothing to do. Use --status, --apply-missing, or --pack <id>.")
            return 0

        if not targets:
            print("\nAll relevant packs already applied (or skipped).")
            if not args.no_verify:
                return rest_verify()
            return 0

        print("\nWill process:")
        for p in targets:
            print(f"  → step {p['step']}: {p['id']} ({p['file']})")

        if not args.yes and not args.dry_run and sys.stdin.isatty():
            ans = input("Apply these packs? [y/N] ").strip().lower()
            if ans not in ("y", "yes"):
                print("Aborted.")
                return 5
        elif not args.yes and not args.dry_run and not sys.stdin.isatty():
            print("Non-interactive shell requires --yes")
            return 5

        failures = 0
        for pack in targets:
            t0 = time.time()
            result = apply_pack(conn, pack, dry_run=args.dry_run)
            dt = time.time() - t0
            print(f"  {pack['id']}: {result} ({dt:.1f}s)")
            if result.startswith("ERROR"):
                failures += 1
                print("Stopping on error (order matters). Fix file or DB, then re-run.")
                break

        if failures:
            return 1
        if not args.no_verify and not args.dry_run:
            return rest_verify()
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
