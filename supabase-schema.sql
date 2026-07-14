-- ============================================================
-- BVS Radio — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT DEFAULT '/assets/images/default-avatar.png',
  bio TEXT,
  website_url TEXT,
  location VARCHAR(100),
  role VARCHAR(20) DEFAULT 'listener' CHECK (role IN ('listener', 'artist', 'moderator', 'admin')),
  is_verified BOOLEAN DEFAULT FALSE,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. GENRES TABLE
CREATE TABLE IF NOT EXISTS genres (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO genres (name, slug) VALUES
  ('Hip-Hop', 'hip-hop'),
  ('Trap', 'trap'),
  ('Afrobeats', 'afrobeats'),
  ('Amapiano', 'amapiano'),
  ('R&B', 'rnb'),
  ('Dancehall', 'dancehall'),
  ('Electronic', 'electronic'),
  ('Lofi', 'lofi'),
  ('Gospel', 'gospel'),
  ('Jazz', 'jazz'),
  ('Pop', 'pop'),
  ('Other', 'other')
ON CONFLICT (name) DO NOTHING;

-- 3. TRACKS TABLE
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  artist_name VARCHAR(100) NOT NULL,
  genre VARCHAR(50),
  description TEXT,
  tags TEXT[],
  bpm INTEGER,
  key_signature VARCHAR(10),
  duration_sec INTEGER,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  artwork_url TEXT DEFAULT '/assets/images/default-artwork.jpg',
  is_downloadable BOOLEAN DEFAULT FALSE,
  download_price NUMERIC(8,2) DEFAULT 0.00,
  download_count INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_is_public ON tracks(is_public);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at DESC);

-- 4. LIKES TABLE
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_track_id ON likes(track_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- 5. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_track_id ON comments(track_id);

-- 6. PLAYLISTS TABLE
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);

-- 7. PLAYLIST TRACKS (join table)
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);

-- 8. ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Tracks: public tracks viewable by all, owners can manage
CREATE POLICY "Public tracks are viewable by everyone" ON tracks
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can insert own tracks" ON tracks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracks" ON tracks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracks" ON tracks
  FOR DELETE USING (auth.uid() = user_id);

-- Likes: viewable by all, authenticated users can manage own
CREATE POLICY "Likes are viewable by everyone" ON likes
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own" ON likes
  FOR DELETE USING (auth.uid() = user_id);

-- Comments: viewable by all, authenticated users can create own
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'listener')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. STORAGE BUCKETS
-- Run this in Supabase Storage section: Create bucket "bvsradio-audio"
-- Set bucket to public

-- 10. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference VARCHAR(40) UNIQUE NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(160) NOT NULL,
  customer_whatsapp VARCHAR(80),
  payment_method VARCHAR(40) NOT NULL,
  project_notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL DEFAULT 'pending_payment',
  delivery_status VARCHAR(40) NOT NULL DEFAULT 'awaiting_payment',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders can be inserted by checkout" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Orders are admin managed" ON orders
  FOR SELECT USING (false);
