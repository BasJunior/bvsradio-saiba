# BVS consumer commerce (no in-stream ads)

## What buyers can do today

1. **Catalogue** → Add to cart / Buy now → Checkout  
2. **Shop** (mix/master) → Buy now → Checkout with price  
3. **Checkout**  
   - **Card** if `STRIPE_SECRET_KEY` is set → Stripe hosted pay  
   - **EcoCash / bank / PayPal** always → order created + payment steps + WhatsApp  

Orders are saved under `data/orders/BVS-*.json` (and Supabase if configured).  
Owner can get Telegram alerts via `BVS_ORDER_TELEGRAM_*`.

## Go live checklist (ASAP)

### Contacts (set)

| Role | Value |
|------|--------|
| WhatsApp (now) | +49 170 6580888 (01706580888) — business number later |
| Orders email | abiaschivayo3@gmail.com (`@bvsradio.com` → forward here on IONOS) |
| Product files | `/home/admin/.openclaw/workspace/bvsradio-products/` |

### 1. Deploy this code to Vercel
Push `bvsradio` and ensure production is https://bvsradio.com

### 2. Paynow (EcoCash) — important

Paynow **API does not use your website login password**.

1. Log into Paynow with the merchant account  
2. Open **Integrate / Integration details**  
3. Copy **Integration ID** + **Integration Key**  
4. Set on Vercel + VPS `.env.local`:
   - `PAYNOW_INTEGRATION_ID=...`
   - `PAYNOW_INTEGRATION_KEY=...`
5. Result URL: `https://bvsradio.com/api/webhooks/paynow`  
6. Return URL: `https://bvsradio.com/checkout/success`

Portal login for humans is stored **only** on the VPS at  
`~/.openclaw/secrets/bvs-paynow-portal.env` (mode 600) — never in git.

### 3. Other env on Vercel

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://bvsradio.com` |
| `NEXT_PUBLIC_BVS_WHATSAPP` | Yes | `+491706580888` |
| `BVS_ORDER_EMAIL` | Yes | `abiaschivayo3@gmail.com` |
| `PAYNOW_INTEGRATION_*` | For auto EcoCash | From Paynow dashboard |
| `BVS_PRODUCTS_DIR` | If downloads | Path to product files (VPS) |
| `STRIPE_*` | Optional | International cards |

### 4. Product delivery

1. Drop files in `bvsradio-products/beats/<id>.zip` (or `.mp3`)  
2. Cart item `id` should match filename  
3. After status `paid`, buyer can use `/api/download?token=...` (or you WhatsApp the file)

Without Paynow keys yet, **manual EcoCash/bank orders still work** via WhatsApp.

### 4. Tell waiting customers

- Listen free: `/radio` (no purchase required, no playback ads)  
- Buy beats: `/catalogue`  
- Book mix/master: `/shop`  
- Pay: `/checkout`

## Prices (defaults)

| Type | Default USD |
|------|-------------|
| Beat | $29 |
| Track / mix download | $2–$4 (catalogue logic) |
| Services | As listed on `/shop` ($39–$299 tiers) |

## Not in this release

- Google ads in the player (skipped by design)  
- Auto file download unlock (after pay, BVS still fulfills via WhatsApp/email until download portal exists)  
- Subscriptions  

## Local test

```bash
cd bvsradio
cp .env.local.example .env.local   # fill WhatsApp etc.
npm run dev
# open /catalogue → cart → /checkout
```

Orders land in `data/orders/`.

### Stripe portal (ops)

Dashboard login is stored only on the VPS at `~/.openclaw/secrets/bvs-payments-portal.env` (mode 600).

API still needs from Stripe → **Developers → API keys**:
- `STRIPE_SECRET_KEY` (`sk_live_…` or `sk_test_…`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_…`)
- Webhook secret for `https://bvsradio.com/api/webhooks/stripe` → `checkout.session.completed`
