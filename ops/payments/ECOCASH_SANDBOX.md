# EcoCash API sandbox setup (Econet)

Portal: [https://developers.ecocash.co.zw](https://developers.ecocash.co.zw)  
Login: [https://developers.ecocash.co.zw/portal](https://developers.ecocash.co.zw/portal)  
Register: [https://developers.ecocash.co.zw/register](https://developers.ecocash.co.zw/register)

## What this is

| Integration | Role |
|-------------|------|
| **EcoCash Developer API** (this doc) | Direct C2B Instant Pay via Econet portal + `X-API-KEY` |
| **Paynow → EcoCash** (existing `src/lib/paynow.ts`) | Aggregator path; still valid for checkout |

You can use **both**. Sandbox here is the **direct EcoCash** API.

## 1. Create a developer account (you do this once)

1. Open [Register](https://developers.ecocash.co.zw/register)
2. Fill: name, email, mobile, National ID, address
3. Sign in at [Portal](https://developers.ecocash.co.zw/portal)
4. Create an **application / API key**
5. Confirm the key is for **Sandbox** (not live money)
6. Copy the **API key** only into a local env file (never git)

## 2. Local env (Mac / Vercel preview)

Add to `.env.local` (gitignored):

```bash
# EcoCash direct API — sandbox
ECOCASH_API_KEY=paste-sandbox-key-here
ECOCASH_MODE=sandbox

# Optional: protect the Next.js test route
ECOCASH_SANDBOX_SECRET=pick-a-long-random-string
```

Production live keys (later only):

```bash
ECOCASH_API_KEY=live-key
ECOCASH_MODE=live
# Never set ECOCASH_ALLOW_LIVE_VIA_SANDBOX_ROUTE unless intentional
```

## 3. API endpoints we use

Base: `https://developers.ecocash.co.zw/api/ecocash_pay`

| Action | Sandbox path |
|--------|----------------|
| C2B payment | `POST /api/v2/payment/instant/c2b/sandbox` |
| Status lookup | `POST /api/v1/transaction/c2b/status/sandbox` |
| Refund | `POST /api/v2/refund/instant/c2b/sandbox` |

Auth header on every call:

```http
Content-Type: application/json
X-API-KEY: <your-sandbox-key>
```

### Payment body

```json
{
  "customerMsisdn": "263771234567",
  "amount": 1.0,
  "reason": "BVS Radio sandbox test",
  "currency": "USD",
  "sourceReference": "BVS-SBX-1710000000000"
}
```

### Lookup body

```json
{
  "sourceMobileNumber": "263771234567",
  "sourceReference": "BVS-SBX-1710000000000"
}
```

Currencies: **USD**, **ZWL**, **ZiG**.

## 4. Code added in this repo

| Path | Purpose |
|------|---------|
| `src/lib/ecocash.ts` | Server-side client (pay / lookup / refund) |
| `src/app/api/payments/ecocash/sandbox/route.ts` | HTTP test endpoint |
| `scripts/test-ecocash-sandbox.mjs` | CLI tester |

## 5. How to test

### A. CLI (fastest after you have a key)

```bash
cd bvsradio-saiba
export ECOCASH_API_KEY='your-sandbox-key'
export ECOCASH_MODE=sandbox

node scripts/test-ecocash-sandbox.mjs config
node scripts/test-ecocash-sandbox.mjs pay 0771234567 1 USD "BVS test"
node scripts/test-ecocash-sandbox.mjs lookup 0771234567 BVS-SBX-...
```

Use a real EcoCash test MSISDN if the portal specifies one; otherwise use your own EcoCash number that sandbox allows.

### B. Next.js route (local)

```bash
npm run dev
curl -s http://localhost:3000/api/payments/ecocash/sandbox | jq .

curl -s -X POST http://localhost:3000/api/payments/ecocash/sandbox \
  -H 'Content-Type: application/json' \
  -H "x-ecocash-sandbox-secret: $ECOCASH_SANDBOX_SECRET" \
  -d '{"action":"pay","msisdn":"0771234567","amount":1,"currency":"USD"}' | jq .
```

## 6. Relationship to Paynow EcoCash

| | Paynow | EcoCash direct |
|--|--------|----------------|
| Env vars | `PAYNOW_INTEGRATION_ID/KEY` | `ECOCASH_API_KEY` |
| Flow | Paynow prompt + poll | C2B push to phone via EcoCash API |
| Checkout today | Already wired | Sandbox client ready; checkout wiring optional next |

## 7. What Abias must do (portal)

1. Register / sign in at developers.ecocash.co.zw  
2. Create app → copy **sandbox** API key  
3. Paste into `.env.local` as `ECOCASH_API_KEY`  
4. Run `node scripts/test-ecocash-sandbox.mjs pay …`  
5. Tell Mac/VPS agent the **result JSON** (redact the key)

## 8. Security

- Never commit `ECOCASH_API_KEY`
- Prefer `ECOCASH_MODE=sandbox` until go-live approval
- Sandbox HTTP route blocks live mode unless explicitly overridden
