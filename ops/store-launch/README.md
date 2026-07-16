# BVS Radio — Store launch (Play + App Store)

**Status:** free-path development (no developer fees required yet)  
**App ID:** `com.bvsradio.app`  
**Shell:** Capacitor → loads https://bvsradio.com  
**Model orchestration:** OpenClaw sessions (GPT 5.6 manager + workers)  
**Human notify:** Telegram only when Abias must act

## Phases

| Phase | Pay? | Owner |
|-------|------|--------|
| 0 Plan + assets + listing drafts | No | Agents |
| 1 Android SDK + release AAB (sideload) | No | Agents |
| 2 Play Console upload / internal track | **$25** | Abias pay + invite/upload |
| 3 iOS Xcode + TestFlight | **$99 + Mac** | Abias pay + Mac |
| 4 Public listings | After 2–3 | Joint |

## Sessions

| Session key | Role |
|-------------|------|
| `bvs-store-manager` | GPT 5.6 — plan, review, assign, block only on human |
| `bvs-store-android` | Worker — Android build / Play prep |
| `bvs-store-ios` | Worker — iOS project prep (no Mac archive yet) |
| `bvs-store-listings` | Worker — store copy, screenshots checklist |

Resume manager:

```bash
openclaw tui --session bvs-store-manager
# or one-shot:
openclaw agent --session-key bvs-store-manager --model openai/gpt-5.6 --message "status"
```

## Human gate (do not ping until these)

See `HUMAN_TASKS.md`.
