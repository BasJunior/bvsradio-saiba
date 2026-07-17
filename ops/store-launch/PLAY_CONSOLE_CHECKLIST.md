# Google Play Console — BVS Radio (do this after $25 paid)

**Package / applicationId:** `com.bvsradio.app`  
**App title:** BVS Radio  
**Developer profile name:** Best Virtual Studios  
**AAB (VPS):** `ops/store-launch/builds/bvsradio-release.aab` (~2.9 MB)  
**Upload key SHA-256 (for reference):**  
`81:B7:D8:4E:F5:D4:67:16:4B:79:EF:4B:78:51:EB:F1:82:6F:CE:9B:A7:60:F1:5D:C6:9B:3B:B2:20:C5:D0:B6`  
*(Play App Signing may use a different cert — always copy SHA-256 from Console after first upload.)*

## Get the AAB onto your computer

From a machine that can reach the VPS (or via scp from Mac once SSH works):

```bash
# example from Mac with Tailscale SSH to VPS:
scp admin@100.117.126.68:~/.openclaw/workspace/bvsradio/ops/store-launch/builds/bvsradio-release.aab ~/Downloads/
```

Or ask VPS agent to place a copy somewhere you can fetch.

## Step-by-step in Console

### 1. Create app
1. https://play.google.com/console  
2. **Create app**  
3. Name: **BVS Radio**  
4. Language: English (United States) or English (UK)  
5. App  
6. **Free**  
7. Declarations: accept  

### 2. Dashboard checklist (complete all)
Work through **Set up your app** / **Grow** / **Publish**:

| Section | What to enter |
|---------|----------------|
| App access | All / no special login required for core listen |
| Ads | **No** (no ads in app for now) |
| Content rating | Use `listings/CONTENT_RATING_ANSWERS.md` |
| Target audience | 13+ or 18+ if explicit music; typically **13+** for music with mild content |
| News app | No |
| COVID / other | No as applicable |
| Data safety | Collects: email if signup; analytics if enabled; shared with payment providers for checkout on web. Encryption in transit: yes |
| Government apps | No |
| Financial features | No (or “payments via website” if asked) |

### 3. Store listing
Copy from `listings/play-store-draft.md` (updated).

| Asset | File |
|-------|------|
| App icon 512×512 | `public/icon-512.png` |
| Feature graphic 1024×500 | `ops/store-launch/assets/feature-graphic.png` |
| Phone screenshots (min 2) | Prefer `assets/screenshots/home.png` + `radio.png` |
| Privacy policy | https://bvsradio.com/privacy |
| Support email | contact@bvsradio.com |
| Website | https://bvsradio.com |

Category: **Music & Audio**

### 4. Internal testing release (first upload)
1. **Test and release → Testing → Internal testing**  
2. Create new release  
3. Upload **`bvsradio-release.aab`**  
4. Release name: `1.0.0 (1)`  
5. Release notes: `Initial BVS Radio release — listen free, catalogue, services.`  
6. Save → Review → **Start rollout to Internal testing**  
7. **Testers** tab → create email list → add your Gmail  
8. Copy **internal testing link** → open on any Android (borrowed/cloud)  

### 5. After AAB accepted — send to VPS agents
**Setup → App integrity → App signing** → copy:

```text
Play App Signing certificate SHA-256:
XX:XX:...
```

Telegram or chat: `play sha256: …`  
Agents will update `public/.well-known/assetlinks.json` and redeploy.

### 6. Production
When internal install works and all checklist green:

1. **Production** → Create release (promote from internal or re-upload same AAB)  
2. Countries: start worldwide or priority regions  
3. **Send for review**  

## Free app + website checkout
Keep the app **Free**. Digital goods (beats/albums) stay on **bvsradio.com** checkout (Stripe/Paynow/WhatsApp). Avoid in-app digital IAP for v1 unless you redesign commerce.

## Parallel with iOS
Mac does TestFlight. You (or VPS guidance) do Play Console. Neither blocks the other.

## When stuck
Paste the Console error screen text to VPS OpenClaw/Grok — do not paste passwords.
