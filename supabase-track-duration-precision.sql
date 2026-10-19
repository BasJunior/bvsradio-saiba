-- Media probes return fractional seconds. Keep catalogue durations compatible.
-- Integer -> numeric is lossless for existing rows; never round verified probes.
SET lock_timeout = '5s';
ALTER TABLE public.tracks ALTER COLUMN duration_sec TYPE numeric USING duration_sec::numeric;
NOTIFY pgrst, 'reload schema';
