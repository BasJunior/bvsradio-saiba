# Enable SSH so VPS agents can write bridge files on your Mac

## One-time on Mac

1. **System Settings → General → Sharing → Remote Login** → **On**
2. Allow access for: your user (e.g. admin / your macOS username)
3. Optional but good: Tailscale app → **Preferences → SSH** / enable Tailscale SSH if offered
4. Confirm firewall allows Remote Login

## Test from VPS (we run this)

```bash
ssh YOUR_MAC_USER@100.77.125.81 'echo ok && hostname'
# or
tailscale ssh YOUR_MAC_USER@abiass-macbook-pro
```

## Then VPS will

- Create `~/BVS-AGENT-BRIDGE/` on Mac
- Sync `HANDOFF-IOS.md` + `from-vps/LATEST.md`
- Leave instructions for Mac Grok to read that folder every turn
