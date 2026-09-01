-- BVS app vNext additive schema.
-- CODE-ONLY HANDOFF: do not apply to production until vNext release approval.
ALTER TABLE public.live_chat_messages ADD COLUMN IF NOT EXISTS room_id TEXT;
UPDATE public.live_chat_messages SET room_id=COALESCE(room_id,broadcast_key,'bvs-live') WHERE room_id IS NULL;
ALTER TABLE public.live_chat_messages ALTER COLUMN room_id SET DEFAULT 'bvs-live';
CREATE INDEX IF NOT EXISTS live_chat_messages_room_feed_idx ON public.live_chat_messages(room_id,created_at DESC) WHERE status='visible';
CREATE TABLE IF NOT EXISTS public.community_blocks(blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(blocker_id,blocked_id),CHECK(blocker_id<>blocked_id));
CREATE INDEX IF NOT EXISTS community_blocks_blocked_idx ON public.community_blocks(blocked_id,blocker_id);
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own blocks" ON public.community_blocks;CREATE POLICY "Users read own blocks" ON public.community_blocks FOR SELECT USING(auth.uid()=blocker_id);
DROP POLICY IF EXISTS "Users create own blocks" ON public.community_blocks;CREATE POLICY "Users create own blocks" ON public.community_blocks FOR INSERT WITH CHECK(auth.uid()=blocker_id AND blocker_id<>blocked_id);
DROP POLICY IF EXISTS "Users delete own blocks" ON public.community_blocks;CREATE POLICY "Users delete own blocks" ON public.community_blocks FOR DELETE USING(auth.uid()=blocker_id);
