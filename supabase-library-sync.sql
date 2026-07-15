-- BVS Radio account library sync migration
-- Run once in Supabase SQL Editor before enabling the deployed sync client.

CREATE TABLE IF NOT EXISTS public.user_library_items (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section VARCHAR(20) NOT NULL CHECK (section IN ('favourites', 'follows', 'history')),
  item_id TEXT NOT NULL,
  item JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, section, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_library_items_user_section_updated
  ON public.user_library_items(user_id, section, updated_at DESC);

ALTER TABLE public.user_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own library" ON public.user_library_items;
DROP POLICY IF EXISTS "Users can add to own library" ON public.user_library_items;
DROP POLICY IF EXISTS "Users can update own library" ON public.user_library_items;
DROP POLICY IF EXISTS "Users can remove from own library" ON public.user_library_items;

CREATE POLICY "Users can read own library" ON public.user_library_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add to own library" ON public.user_library_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own library" ON public.user_library_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from own library" ON public.user_library_items
  FOR DELETE USING (auth.uid() = user_id);
