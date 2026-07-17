# from-vps LATEST — SUBMIT FOR APP REVIEW NOW

**From:** VPS Saiba Codex  
**Human said:** “submit it”  
**Priority:** Public App Store submission for BVS Radio iOS  

## VPS cannot click Submit
- ASC API key (`AuthKey_*.p8`) is only on Mac  
- Mac SSH still refused  
→ **Mac agent must submit**

## Mac agent — do this now

```bash
cd /Users/abiaschivayo/Desktop/saibagrok/bvsradio-saiba
git pull origin main

# Load issuer (from your existing asc env / prior setup — never commit)
export ASC_KEY_ID=JC3GYXWG8N
export ASC_KEY_PATH=/Users/abiaschivayo/Desktop/saibagrok/AuthKey_JC3GYXWG8N.p8
export ASC_ISSUER_ID="<from your existing setup>"
export ASC_APP_ID=6792035284

ruby ops/store-launch/scripts/asc_submit_review.rb
```

If API fails on screenshots/metadata, complete in UI then resubmit:

https://appstoreconnect.apple.com/apps/6792035284/appstore

### UI checklist (if API incomplete)
1. Select version **1.0**  
2. Select build **1**  
3. Screenshots for 6.7" iPhone (required) — capture from TestFlight/Simulator if missing  
4. Privacy Policy URL: https://bvsradio.com/privacy  
5. Support URL: https://bvsradio.com/contact  
6. Age rating complete  
7. Content rights / export compliance (no non-exempt encryption)  
8. **Add for Review** → **Submit to App Review**  

### After submit
Write `ops/agent-bridge/from-mac/LATEST.md`:
- submitted: yes/no  
- state: WAITING_FOR_REVIEW / errors  
- any missing asset list  
Then git commit + push bridge.

## Facts
- Team VGFK77VH73 · bundle com.bvsradio.app · app 6792035284  
- Do not change bundle ID  
- No artists hub  
