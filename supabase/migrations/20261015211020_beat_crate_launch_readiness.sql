-- Server-only recoverable beat drafts, and one atomic, retry-safe finalization.
create table if not exists public.beat_upload_drafts (
 id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 payload jsonb not null default '{}'::jsonb,
 state text not null default 'draft' check (state in ('draft','submitted')),
 result jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists beat_upload_drafts_owner_idx on public.beat_upload_drafts(user_id, updated_at desc);
alter table public.beat_upload_drafts enable row level security;
revoke all on public.beat_upload_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.beat_upload_drafts to service_role;
create table if not exists public.beat_crate_entries (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 instagram_username text not null check (instagram_username ~ '^[A-Za-z0-9._]{1,30}$'),
 joined_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.beat_crate_entries enable row level security;
revoke all on public.beat_crate_entries from public, anon, authenticated;
grant select, insert, update on public.beat_crate_entries to service_role;
alter table public.beats add column if not exists submitted_at timestamptz;
alter table public.beats add column if not exists upload_audio_hash text;
create unique index if not exists beats_owner_audio_hash_unique on public.beats(producer_user_id, upload_audio_hash)
 where upload_audio_hash is not null and status <> 'suspended';

create or replace function public.finalize_beat_upload(p_user_id uuid, p_draft_id uuid, p_updated_at timestamptz, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare d public.beat_upload_drafts%rowtype; item jsonb; b uuid; pack uuid; ids jsonb := '[]'::jsonb; answer jsonb; pos integer := 0;
begin
 select * into d from public.beat_upload_drafts where id=p_draft_id and user_id=p_user_id for update;
 if not found then raise exception 'Upload draft not found'; end if;
 if d.state='submitted' then return d.result; end if;
 if d.updated_at <> p_updated_at then raise exception 'Draft changed. Refresh before submitting'; end if;
 if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 25 then raise exception 'Choose 1–25 beats'; end if;
 if coalesce((d.payload->>'rights')::boolean, false) is not true then raise exception 'Confirm rights'; end if;
 -- Serialize different drafts from this producer as well as retries of the same draft.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 92625));
 if jsonb_array_length(p_items)>1 then
  insert into public.beat_packs(producer_user_id,title,description,genre,artwork_path,status,is_public)
  values(p_user_id,coalesce(nullif(d.payload->>'title',''),'Beat crate'),coalesce(d.payload->>'description',''),coalesce(d.payload->>'genre',''),nullif(d.payload->>'artworkPath',''),'submitted',false) returning id into pack;
 end if;
 for item in select * from jsonb_array_elements(p_items) loop
  pos := pos + 1;
  insert into public.beats(producer_user_id,title,slug,description,genre,mood,bpm,musical_key,artwork_path,preview_path,master_path,rights_confirmed,status,is_public,pack_id,pack_position,submitted_at,upload_audio_hash)
  values(p_user_id,item->>'title',item->>'slug',coalesce(d.payload->>'description',''),coalesce(d.payload->>'genre',''),coalesce(item->>'mood',''),nullif(item->>'bpm','')::integer,nullif(item->>'musicalKey',''),nullif(item->>'artworkPath',''),item->>'previewPath',nullif(item->>'masterPath',''),true,'submitted',false,pack,case when pack is null then null else pos end,now(),nullif(item->>'audioHash','')) returning id into b;
  insert into public.beat_licence_options(beat_id,licence_code,licence_name,price_usd,currency,included_files,is_active,terms_version,terms_summary)
  values(b,'standard_lease',item->'licence'->>'licence_name',(item->>'price')::numeric,'usd',array(select jsonb_array_elements_text(item->'licence'->'included_files')),true,item->'licence'->>'terms_version',item->'licence'->>'terms_summary');
  ids := ids || jsonb_build_array(b);
 end loop;
 answer := jsonb_build_object('count',pos,'beatIds',ids,'packId',pack);
 update public.beat_upload_drafts set state='submitted',result=answer,updated_at=now() where id=d.id;
 return answer;
end $$;
revoke all on function public.finalize_beat_upload(uuid,uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.finalize_beat_upload(uuid,uuid,timestamptz,jsonb) to service_role;
