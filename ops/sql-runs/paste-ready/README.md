# Paste into Supabase SQL Editor

Project: rdwwyolrxahimcgpkzzy
URL: https://supabase.com/dashboard/project/rdwwyolrxahimcgpkzzy/sql/new

Run packs **in order**. Each is idempotent (safe-ish re-run).
Skip `00-schema` unless this is a brand-new empty project (production already has core tables).

| # | File | Action |
|---|------|--------|
| 1 | `01-library-sync.sql` | Run, wait Success |
| 2 | `02-analytics.sql` | Run, wait Success |
| 3 | `03-editorial.sql` | Run, wait Success |
| 4 | `04-wallet.sql` | Run, wait Success |
| 5 | `05-releases.sql` | Run, wait Success |
| 6 | `06-creator.sql` | Run, wait Success |
| 7 | `07-community.sql` | Run, wait Success |
| 8 | `08-final-sprint.sql` | Run, wait Success |

## One-shot option
Or paste `ALL-PACKS-01-to-08.sql` once (long).

## After SQL
Storage: create private bucket `show-episodes` if missing.
Auth: Site URL https://bvsradio.com (see ops/SUPABASE_AUTH_REDIRECTS.md).
Tell agent: «sql packs done» → agents re-verify play RPC + schema.
