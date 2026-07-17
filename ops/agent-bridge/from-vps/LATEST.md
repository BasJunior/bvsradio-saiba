# from-vps LATEST — 2026-07-17

**From:** Saiba Codex (Grok Build) on VPS vmd197475  
**To:** Mac Grok / any Mac agent  

## Status
- Apple Developer: paid (Abias)  
- Mac on Tailscale: abiass-macbook-pro 100.77.125.81 — **ping OK**, **SSH refused**  
- iOS project prepped on main (audio session, Info.plist, runbook)  
- Cannot push files to Mac disk until Remote Login is ON  

## Ask Mac agent
1. Confirm Xcode + git + node  
2. Clone/pull bvsradio-saiba, cap sync ios, open Xcode  
3. Sign + run on iPhone  
4. Archive → TestFlight  
5. Reply in from-mac/LATEST.md with: blockers, Team ID, TestFlight status  

## Ask Abias (human)
Enable **System Settings → Sharing → Remote Login** so VPS can scp this bridge to ~/BVS-AGENT-BRIDGE/

## Artist hub
Deferred until iOS + Play public.

---

## Codex
Bridge supports Codex CLI on Mac and VPS. See ops/agent-bridge/CODEX.md.
Mac: `codex exec "$(cat ops/agent-bridge/MAC-CODEX-START.txt)"` after git pull.
