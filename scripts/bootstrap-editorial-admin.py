#!/usr/bin/env python3
"""Promote Abias owner accounts to editorial administrator. Uses env from vercel env run."""
import json
import os
import sys
import urllib.request

url = (os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
print("url_ok", url.startswith("http"), "service_len", len(service))
if not url.startswith("http") or len(service) < 20:
    print("Missing Supabase env. Run via: npx vercel env run --environment=production -- python3 scripts/bootstrap-editorial-admin.py")
    sys.exit(1)


def req(path, method="GET", body=None, prefer=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "apikey": service,
        "Authorization": f"Bearer {service}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(f"{url}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request) as res:
            text = res.read().decode()
            return res.status, json.loads(text) if text else None
    except Exception as exc:  # noqa: BLE001
        if hasattr(exc, "read"):
            return getattr(exc, "code", 0), exc.read().decode()[:800]
        return 0, str(exc)


status, users = req("/auth/v1/admin/users?page=1&per_page=200")
print("users_status", status)
user_list = (users or {}).get("users") if isinstance(users, dict) else []
if not isinstance(user_list, list):
    print("users_payload", str(users)[:400])
    sys.exit(1)

targets = []
for user in user_list:
    email = (user.get("email") or "").lower()
    if any(token in email for token in ("abiaschivago", "abiaschivayo", "chivago", "chivayo")):
        targets.append(user)
        print("MATCH", user["id"], email)

if not targets:
    print("No matching users among", len(user_list))
    for user in user_list[:30]:
        email = user.get("email") or ""
        print(" sample", email.split("@")[-1] if "@" in email else email)
    sys.exit(2)

st, staff = req("/rest/v1/editorial_staff?select=user_id,role,active")
print("staff_before", st, staff)

for user in targets:
    uid = user["id"]
    email = user.get("email")
    st1, prof = req(f"/rest/v1/profiles?id=eq.{uid}&select=id,username,display_name,role")
    print("profile_before", email, st1, prof)
    st2, patched = req(
        f"/rest/v1/profiles?id=eq.{uid}",
        method="PATCH",
        body={"role": "admin"},
        prefer="return=representation",
    )
    print("profile_patch", st2, patched)
    st3, staff_up = req(
        "/rest/v1/editorial_staff?on_conflict=user_id",
        method="POST",
        body={"user_id": uid, "role": "administrator", "active": True},
        prefer="resolution=merge-duplicates,return=representation",
    )
    print("staff_upsert", st3, staff_up)

stf, staff2 = req("/rest/v1/editorial_staff?select=user_id,role,active")
print("staff_after", stf, staff2)
print("done")
