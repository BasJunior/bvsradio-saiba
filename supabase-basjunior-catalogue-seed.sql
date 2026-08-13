-- BasJunior Amuse catalogue → BVS ISRC/Spotify seed
-- Safe/idempotent. Only sets ISRC and Spotify fields; does not replace existing data.
-- Run after supabase-spotify-catalogue-link.sql

-- 1. Ensure BasJunior profile has Spotify artist ID
UPDATE public.profiles
SET
  spotify_artist_id = COALESCE(NULLIF(BTRIM(spotify_artist_id), ''), '6YFW80yi3gjIqoXtOErObH'),
  spotify_url = COALESCE(
    NULLIF(BTRIM(spotify_url), ''),
    'https://open.spotify.com/artist/6YFW80yi3gjIqoXtOErObH'
  ),
  updated_at = NOW()
WHERE lower(username) IN ('basjunior', 'admin', 'bvsadmin', 'bvs-admin');

-- 2. Update existing BVS tracks that match known ISRCs by title match
-- BVS album tracks (only set ISRC where currently NULL/empty)
UPDATE public.tracks AS t
SET
  isrc = COALESCE(NULLIF(BTRIM(t.isrc), ''), v.isrc),
  spotify_url = COALESCE(NULLIF(BTRIM(t.spotify_url), ''), v.spotify_url),
  spotify_track_id = COALESCE(NULLIF(BTRIM(t.spotify_track_id), ''), v.spotify_track_id),
  updated_at = NOW()
FROM (VALUES
  ('Robert Gabriel Mugabe International Airport', 'SE6XY2585728', 'https://open.spotify.com/track/SE6XY2585728'::TEXT, NULL::TEXT),
  ('Slide',                    'SE6XY2585729', NULL, NULL),
  ('Never Ending',            'SE6XY2585730', NULL, NULL),
  ('Starve',                  'SE6XY2585731', NULL, NULL),
  ('A B 2 C',                 'SE6XY2585732', NULL, NULL),
  ('Nerve',                   'SE6XY2585733', 'https://open.spotify.com/track/7IGd0g1mIhHfL7HYGjDbfE'::TEXT, NULL),
  ('On The Moon',             'SE6XY2585734', NULL, NULL),
  ('Deep',                    'SE6XY2585735', 'https://open.spotify.com/track/0qWlwJksSmv0ahGN314I1u'::TEXT, NULL),
  ('Uptown Wins',             'SE6XY2585736', NULL, NULL),
  ('Having Fun',              'SE6XY2585737', NULL, NULL),
  ('Sum''o',                  'SE6XY2585738', NULL, NULL),
  ('Party Tarpy',             'SE6XY2585739', 'https://open.spotify.com/track/4a6MrGJAVXiNaeZV5wu4I9'::TEXT, NULL),
  ('Sad Addict',              'SE6XY2585740', NULL, NULL)
) AS v(title_match, isrc, spotify_url, spotify_track_id)
WHERE lower(t.artist_name) LIKE '%basjunior%'
  AND lower(t.title) = lower(v.title_match)
  AND (t.isrc IS NULL OR BTRIM(t.isrc) = '');

-- 3. For new tracks not yet in BVS: log them as known ISRCs
-- (create via editorial/workspace later - this block is informational)
INSERT INTO public.known_isrc_map (isrc, title, artist_name, upc, spotify_album_url, source)
SELECT isrc, title, 'BasJunior', upc, spotify_album_url, 'amuse_api'
FROM (VALUES
  ('SE6XY2585728'::TEXT, 'Robert Gabriel Mugabe International Airport'::TEXT, '7300344470365'::TEXT, NULL::TEXT),
  ('SE6XY2585729', 'Slide', '7300344470365', NULL),
  ('SE6XY2585730', 'Never Ending', '7300344470365', NULL),
  ('SE6XY2585731', 'Starve', '7300344470365', NULL),
  ('SE6XY2585732', 'A B 2 C', '7300344470365', NULL),
  ('SE6XY2585733', 'Nerve', '7300344470365', 'https://open.spotify.com/album/1BacVRIjii3qwqzsoIw6Rq'),
  ('SE6XY2585734', 'On The Moon', '7300344470365', NULL),
  ('SE6XY2585735', 'Deep', '7300344470365', NULL),
  ('SE6XY2585736', 'Uptown Wins', '7300344470365', NULL),
  ('SE6XY2585737', 'Having Fun', '7300344470365', NULL),
  ('SE6XY2585738', 'Sum''o', '7300344470365', NULL),
  ('SE6XY2585739', 'Party Tarpy', '7300344470365', NULL),
  ('SE6XY2585740', 'Sad Addict', '7300344470365', NULL),
  ('SE6XX2562079', 'Fire', '7300344949441', NULL),
  ('SE5BU2508215', 'Party Tarpy - Demo', '7300343333135', NULL),
  ('SE6XW2406310', 'NERVE DRAFT 1', '7300343118138', NULL),
  ('SE6I32036194', 'Notausgang', '0707856277005', NULL),
  ('SE6HN2056359', 'noexit', '0707856071658', NULL),
  ('SE5751972600', 'Palm Tree Dreams - Extended Version', '0753215343218', 'https://open.spotify.com/album/34sbrqFkFhuOWOn7lob8GG'),
  ('SE6A91989937', 'WHKP', '0707772109251', 'https://open.spotify.com/album/1KuacsCkSc49Sk6bcMrE0T'),
  ('SE5752023783', 'Gas - Freestyle', '0793420485952', NULL),
  ('SE6HN1970796', 'Cash Rules', '0631060392882', NULL),
  ('SE6HN1919156', 'Live Tonight', '0631060205649', NULL)
) AS v(isrc, title, upc, spotify_album_url)
ON CONFLICT (isrc) DO UPDATE SET
  title = EXCLUDED.title,
  upc = EXCLUDED.upc,
  spotify_album_url = COALESCE(known_isrc_map.spotify_album_url, EXCLUDED.spotify_album_url),
  source = EXCLUDED.source,
  updated_at = NOW();
