alter table public.creator_upload_sessions
  add column if not exists cleaned_at timestamptz null,
  add column if not exists cleanup_error text null;

create index if not exists creator_upload_sessions_cleanup_idx
  on public.creator_upload_sessions (cleaned_at, expires_at, state)
  where cleaned_at is null and state in ('preparing', 'uploading', 'uploaded', 'failed', 'abandoned');

comment on column public.creator_upload_sessions.cleaned_at is
  'When abandoned/expired upload media was removed from object storage. Submission metadata remains for audit.';
comment on column public.creator_upload_sessions.cleanup_error is
  'Last non-fatal media cleanup error; null after successful cleanup.';
