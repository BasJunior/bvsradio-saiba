#!/usr/bin/env python3
import json, os, urllib.request, sys

url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
print("url_ok", url.startswith("http"), "key_len", len(key))
if not url.startswith("http") or len(key) < 20:
    sys.exit(2)

def get(path):
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read().decode()
            return r.status, json.loads(body) if body else None
    except Exception as e:
        if hasattr(e, "read"):
            return getattr(e, "code", 0), e.read().decode()[:400]
        return 0, str(e)

for path in [
    "releases?select=id,title,editorial_status,is_public,in_rotation,track_count&order=created_at.desc&limit=10",
    "release_tracks?select=id,release_id,title,position&limit=10",
    "distribution_jobs?select=id,status&limit=5",
    "profiles?select=premium_active,distribution_enabled&limit=1",
    "tracks?select=id,title,in_rotation,is_public,editorial_status,release_id&in_rotation=eq.true&limit=10",
]:
    st, body = get(path)
    print("---", path.split("?")[0], st)
    print(json.dumps(body, indent=2)[:600] if not isinstance(body, str) else body[:600])
