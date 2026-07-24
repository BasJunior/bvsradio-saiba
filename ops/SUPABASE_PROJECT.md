# BVS Supabase project

| Field | Value |
|-------|--------|
| **Project ref** | `rdwwyolrxahimcgpkzzy` |
| **Dashboard** | https://supabase.com/dashboard/project/rdwwyolrxahimcgpkzzy |
| **SQL Editor** | https://supabase.com/dashboard/project/rdwwyolrxahimcgpkzzy/sql/new |
| **API URL** | `https://rdwwyolrxahimcgpkzzy.supabase.co` |

## Apply packs (Abias — SQL Editor)

Paste-ready files on VPS:

`bvsradio/ops/sql-runs/paste-ready/`

1. Open SQL Editor (link above)  
2. Run **in order** `01` … `08` (or one-shot `ALL-PACKS-01-to-08.sql`)  
3. Storage → create private bucket **`show-episodes`** if missing  
4. Auth → URL config → Site URL `https://bvsradio.com` (see `SUPABASE_AUTH_REDIRECTS.md`)  
5. Telegram agents: **sql packs done**

## Agent apply (after one-time secret)

```bash
# ~/.openclaw/secrets/bvs-supabase-db.env  (chmod 600)
DATABASE_URL=postgresql://postgres.[ref]:[password]@...:5432/postgres
```

Then: `python3 scripts/apply-supabase-packs.py --apply-missing --yes`
