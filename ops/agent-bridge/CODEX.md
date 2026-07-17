# Using the bridge with Codex (and OpenClaw)

Yes — **Codex can instruct / be instructed through this bridge.**  
It is not Grok-only. Any agent that can read and write files in the repo works.

## Who can use it

| Agent | Role |
|--------|------|
| **Grok Build (VPS)** | Writes `from-vps/`, reads `from-mac/` |
| **OpenClaw / Saiba (VPS)** | Same |
| **Codex CLI (VPS or Mac)** | Same |
| **Grok on Mac** | Same |
| **Claude / Cursor on Mac** | Same |

## Codex on the Mac (typical)

```bash
cd ~/bvsradio-saiba   # or your clone path
git pull

# Option A — one-shot instruction that forces bridge protocol
codex exec "$(cat ops/agent-bridge/MAC-CODEX-START.txt)"

# Option B — interactive
codex
# then paste contents of MAC-CODEX-START.txt as first message
```

Or:

```bash
codex "Read ops/agent-bridge/HANDOFF-IOS.md and ops/agent-bridge/from-vps/LATEST.md then continue iOS. End by writing ops/agent-bridge/from-mac/LATEST.md and git push if possible."
```

## Codex / OpenClaw on the VPS → Mac

To **instruct the Mac model** without chat history:

1. Edit `ops/agent-bridge/from-vps/LATEST.md` with clear tasks.
2. Optionally copy to `from-vps/log/YYYY-MM-DD-HHMM.md`.
3. `git add ops/agent-bridge && git commit -m "bridge: vps instruct mac" && git push`
4. On Mac: `git pull` then run Codex/Grok with MAC-CODEX-START / MAC-GROK-START.

VPS Codex one-liner:

```bash
cd ~/.openclaw/workspace/bvsradio
# edit from-vps/LATEST.md then:
git add ops/agent-bridge/from-vps && git commit -m "bridge: instruct mac" && git push
```

## Rules for every agent

1. **Start of turn:** `git pull` → read `HANDOFF-IOS.md` + `from-vps/LATEST.md` (Mac) or `from-mac/LATEST.md` (VPS).  
2. **End of turn:** update your side’s `LATEST.md`, commit+push bridge files when you can.  
3. **Do not** put secrets (keys, passwords, .p12) in the bridge.  
4. **Priority:** iOS → Play → then artists hub.  

## After Tailscale SSH is on

Codex on VPS can also:

```bash
scp ops/agent-bridge/from-vps/LATEST.md USER@abiass-macbook-pro:~/bvsradio-saiba/ops/agent-bridge/from-vps/
```

Git remains the default so offline Mac Grok still works.
