# Supabase Auth redirects (BVS production)

## Required dashboard settings

**Authentication → URL configuration**

| Field | Value |
|-------|--------|
| Site URL | `https://bvsradio.com` |
| Redirect URLs | `https://bvsradio.com/auth/confirmed` |
| | `https://bvsradio.com/auth/reset-password` |
| | `https://bvsradio.com/**` (optional wildcard) |

Do **not** leave Site URL as `http://localhost:3000`.

## Custom SMTP (so confirmation emails actually arrive)

See `SUPABASE_SMTP_IONOS.md`:

- Host: `smtp.ionos.de`
- Port: `587`
- User: `contact@bvsradio.com`
- Password: contact@ mailbox password
- Sender: `BVS Radio <contact@bvsradio.com>`

Without custom SMTP, Supabase only mails project team addresses and rate-limits hard.

## App behaviour (after deploy)

- Signup / resend / password reset always set `emailRedirectTo` to **https://bvsradio.com/...** via `NEXT_PUBLIC_SITE_URL` (never browser localhost).
- `/auth/confirmed` handles `code`, `token_hash`, and hash tokens.
- Navbar shows email + Sign out when session exists.
