# BVS Radio Beta Supabase project

| Field | Value |
|-------|--------|
| **Project ref** | `kuqdhuomcqonhnwfgrlw` |
| **Dashboard** | https://supabase.com/dashboard/project/kuqdhuomcqonhnwfgrlw |
| **SQL Editor** | https://supabase.com/dashboard/project/kuqdhuomcqonhnwfgrlw/sql/new |
| **API URL** | `https://kuqdhuomcqonhnwfgrlw.supabase.co` |

This worktree must never use the production project ref `rdwwyolrxahimcgpkzzy`.

## Agent-owned setup

1. Export beta credentials from `~/.openclaw/secrets/bvs-supabase-beta.env`.
2. Run `python3 scripts/apply-supabase-packs.py --apply-missing --yes`.
3. Run `python3 scripts/verify-supabase-schema.py --full`.
4. Auth Site URL and redirects must use `https://bvsradio-beta.vercel.app`.
5. Media objects use the isolated `beta/` R2 key prefix.

The database-only compatibility secret is stored separately:

```bash
# ~/.openclaw/secrets/bvs-supabase-beta-db.env  (chmod 600)
DATABASE_URL=postgresql://postgres:[password]@db.kuqdhuomcqonhnwfgrlw.supabase.co:5432/postgres
```
