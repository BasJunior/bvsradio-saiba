# Supabase Auth redirects (BVS production)

## Symptom you may see

```
http://localhost:3000/?error=access_denied&error_code=otp_expired
&error_description=Email+link+is+invalid+or+has+expired
```

That means **two things at once**:

1. **Site URL in Supabase is still `http://localhost:3000`**  
   Failed confirmations always redirect to **Site URL**. Localhost = wrong dashboard config.
2. **`otp_expired`** — the one-time token is already dead  
   Common when the mail app / Gmail / security scanner opens the link before the member does.  
   The old email will never work; send a **new** confirmation after fixing Site URL.

## Required dashboard settings

**Authentication → URL configuration**

| Field | Value |
|-------|--------|
| Site URL | `https://bvsradio.com` |
| Redirect URLs | `https://bvsradio.com/auth/confirmed` |
| | `https://bvsradio.com/auth/reset-password` |
| | `https://bvsradio.com/**` (optional wildcard) |
| | `http://localhost:3000/**` only if you need local auth testing |

Do **not** leave Site URL as `http://localhost:3000`.

Also set Vercel env: `NEXT_PUBLIC_SITE_URL=https://bvsradio.com` (Production + Preview).

## What members should do after you fix Site URL

1. Open https://bvsradio.com/auth/signup  
2. Enter the same email → use **Resend confirmation** (or complete signup again)  
3. Open the **newest** email  
4. Tap the link in a real browser tab (not the inbox preview pane)

## Custom SMTP (so confirmation emails actually arrive)

See `SUPABASE_SMTP_IONOS.md`:

- Host: `smtp.ionos.de`
- Port: `587`
- User: `contact@bvsradio.com`
- Password: contact@ mailbox password
- Sender: `BVS Radio <contact@bvsradio.com>`

Without custom SMTP, Supabase only mails project team addresses and rate-limits hard.

## App behaviour (after deploy)

- **Signup confirmation emails are sent by BVS** (`contact@bvsradio.com` via IONOS SMTP), not the default Supabase Auth mailer.
- `/api/auth/signup` creates the user, generates a Supabase token via admin `generate_link`, and emails a **first-party** link:
  `https://bvsradio.com/auth/confirmed?token_hash=...&type=signup|magiclink`
  so members never have to open `*.supabase.co/auth/v1/verify` (that hop was still able to bounce to localhost when Site URL was wrong).
- Resend uses the same BVS mail path (`resendOnly: true`).
- Password reset also uses BVS mail: `/api/auth/forgot-password` → recovery `generate_link` → email from `contact@bvsradio.com` with first-party
  `https://bvsradio.com/auth/reset-password?token_hash=...&type=recovery`.
- `/auth/confirmed` handles `code`, `token_hash`, hash tokens, and Supabase error query params.
- `AuthLinkRescue` forwards `/?error=...` (and success tokens that land on home) to `/auth/confirmed`.
- Navbar shows email + Sign out when session exists.

### Vercel env required for branded confirm mail

| Var | Value |
|-----|--------|
| `SMTP_HOST` | `smtp.ionos.de` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `contact@bvsradio.com` |
| `SMTP_PASS` | contact@ mailbox password |
| `SMTP_FROM` | `BVS Radio <contact@bvsradio.com>` |
| `NEXT_PUBLIC_SITE_URL` | `https://bvsradio.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (already on Production) |
