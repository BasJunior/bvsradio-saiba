# Supabase custom SMTP (BVS / IONOS Option A)

Verified on VPS: **smtp.ionos.de** works; **smtp.ionos.com** does not for this mailbox.

## Dashboard path
Supabase project → **Authentication** → **Emails** / **SMTP** → enable **Custom SMTP**

| Field | Value |
|-------|--------|
| Sender email | `contact@bvsradio.com` |
| Sender name | `BVS Radio` |
| Host | `smtp.ionos.de` |
| Port | `587` |
| Username | `contact@bvsradio.com` |
| Password | contact@ mailbox password (see VPS `~/.openclaw/secrets/bvs-ionos-smtp.env` — do not paste in chat) |

## URL config
- Site URL: `https://bvsradio.com`
- Redirect allowlist: `https://bvsradio.com/auth/confirmed`

## Why not noreply@?
`noreply@bvsradio.com` is **Weiterleitung** only (forward to Gmail). No SMTP. Use **contact@** (Mail Basic).

## VPS secret
`/home/admin/.openclaw/secrets/bvs-ionos-smtp.env` (chmod 600)
