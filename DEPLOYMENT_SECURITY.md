# Vercel checkpoint runbook

The public homepage and key routes currently return normal `200` responses, and the Vercel firewall API reports no active custom firewall configuration. During automated multi-page review, Vercel intermittently showed its “verifying your browser” checkpoint. That points to temporary Attack Mode or Vercel system mitigation, not a Next.js route failure.

Before each public launch:

1. Open **Vercel → BVS project → Firewall** and confirm Attack Mode is off unless the site is under active attack.
2. Keep Vercel system mitigations enabled. Do not disable DDoS protection to accommodate a crawler.
3. Test `/`, `/radio`, `/catalogue`, `/shows`, `/search`, `/upload`, and `/shop` in a signed-out browser and on mobile data.
4. If ordinary visitors receive a checkpoint, disable Attack Mode with `vercel firewall attack-mode disable --yes`, then repeat the signed-out tests.
5. If only automation is blocked, use a narrowly scoped automation bypass instead of weakening protection for every visitor.

Useful read-only diagnostic:

```bash
vercel api '/v1/security/firewall/config?projectId=<project-id>'
```

Application code cannot reliably bypass a Vercel edge challenge. Treat this as deployment configuration and verify it after every firewall change.
