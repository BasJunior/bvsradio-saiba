# Agent bridge (VPS ↔ Mac)

Shared text channel so Grok Build / OpenClaw on the VPS and models on Abias’s Mac stay in sync when chat histories differ.

## Locations

| Path | Role |
|------|------|
| `ops/agent-bridge/from-vps/` | Messages **written by VPS agents** for Mac to read |
| `ops/agent-bridge/from-mac/` | Messages **written by Mac agents** for VPS to read |
| `ops/agent-bridge/STATUS.md` | One-line current phase |
| `ops/agent-bridge/HANDOFF-IOS.md` | Full iOS launch context for Mac model |

## Protocol (keep it simple)

1. **VPS agent** updates `from-vps/LATEST.md` + appends a dated file in `from-vps/log/`.
2. **Mac agent** (start of turn): `git pull`, read `from-vps/LATEST.md` and `HANDOFF-IOS.md`.
3. **Mac agent** (end of turn): write `from-mac/LATEST.md` with progress/blockers, commit+push if possible, or Abias pastes it.
4. **VPS agent**: `git pull` or read after Abias says “mac updated bridge”.

## Prefer over chat paste when:

- Switching machines
- Multiple models (Grok Mac, OpenClaw, Grok VPS)
- Long-running iOS Archive / TestFlight work

## Direct SSH drop (after Remote Login enabled)

```bash
# From VPS
scp -r ops/agent-bridge/from-vps/ abias@abiass-macbook-pro:~/bvsradio-saiba/ops/agent-bridge/from-vps/
# Or write:
ssh abias@abiass-macbook-pro 'cat > ~/BVS-AGENT-BRIDGE/from-vps/LATEST.md'
```

Mac path convention: `~/BVS-AGENT-BRIDGE/` (symlink to repo ops/agent-bridge if cloned).
