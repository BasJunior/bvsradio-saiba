export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: 'listener' | 'artist' | 'admin'
  is_verified: boolean
  follower_count: number
  following_count: number
  created_at: string
}

export interface Track {
  id: string
  user_id: string
  title: string
  artist_name: string
  genre: string
  description: string | null
  duration_sec: number
  file_url: string
  artwork_url: string
  play_count: number
  like_count: number
  is_public: boolean
  is_featured: boolean
  created_at: string
  profiles?: Profile
}

export interface Genre {
  id: number
  name: string
  slug: string
}