# BVS producer collaboration SQL

Project: `rdwwyolrxahimcgpkzzy`

1. Open Supabase Dashboard → BVS project → SQL Editor.
2. Open `supabase-producer-collaboration.sql`.
3. Copy the complete SQL into a new query.
4. Click **Run** once.
5. Confirm the result reports success, then tell Saiba: **producer SQL applied**.

The migration is idempotent. It creates the `beat_review_messages` table, indexes,
row-level security, and producer read/write policies. It does not delete existing data.
