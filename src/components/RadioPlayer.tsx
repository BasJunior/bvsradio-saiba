'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Track {
  title: string;
  artist: string;
  src: string;
}

interface RadioPlayerProps {
  tracks?: Track[];
  stationName?: string;
}

export default function RadioPlayer({ 
  tracks = [],
  stationName = "BVS Radio Live" 
}: RadioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = tracks[currentTrackIndex];

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (!currentTrack) {
      setError("No tracks are available yet.");
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        setError(null);

        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Playback error:", err);
      setError("Failed to play this track. Try the next one.");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);

    if (audioRef.current) {
      audioRef.current.load();

      if (isPlaying && currentTrack) {
        audioRef.current.play().catch((err) => {
          console.error("Track change playback error:", err);
          setError("Failed to play this track. Try the next one.");
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrackIndex]);

  const playTrackAt = (index: number) => {
    if (tracks.length === 0) return;
    setError(null);
    setCurrentTrackIndex((index + tracks.length) % tracks.length);
  };

  const playPrevious = () => {
    playTrackAt(currentTrackIndex - 1);
  };

  const playNext = () => {
    playTrackAt(currentTrackIndex + 1);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleError = () => {
    setError("Track error. This file may be unavailable.");
    setIsPlaying(false);
    setIsLoading(false);
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="w-full max-w-xl mx-auto">
      <audio
        ref={audioRef}
        src={currentTrack?.src}
        preload="none"
        playsInline
        controlsList="nodownload"
        onError={handleError}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={playNext}
      />

      {/* Player Card */}
      <div className="bg-bg-card/80 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
        {/* Station Info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">{stationName}</h2>
          <p className="text-text-secondary text-sm mt-1">
            {tracks.length > 0 ? `${tracks.length} tracks in rotation` : "No tracks loaded"}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mb-6 text-center min-h-[4rem]">
          <p className="text-lg font-semibold text-text-primary truncate">
            {currentTrack?.title || "BVS Radio Library"}
          </p>
          <p className="text-sm text-text-secondary truncate">
            {currentTrack?.artist || "BVS Radio"}
          </p>
        </div>

        {/* Player Controls */}
        <div className="flex items-center justify-center gap-5 mb-8">
          <button
            onClick={playPrevious}
            disabled={tracks.length === 0}
            className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-text-primary transition-all active:scale-95 disabled:opacity-40"
            aria-label="Previous track"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6V6zm3.5 6L18 6v12l-8.5-6z" />
            </svg>
          </button>
          <button
            onClick={togglePlay}
            disabled={isLoading || tracks.length === 0}
            className="w-20 h-20 bg-brand hover:bg-brand-dark rounded-full flex items-center justify-center text-black transition-all active:scale-95 disabled:opacity-50"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-9 h-9 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={playNext}
            disabled={tracks.length === 0}
            className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-text-primary transition-all active:scale-95 disabled:opacity-40"
            aria-label="Next track"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 6h2v12h-2V6zM6 18V6l8.5 6L6 18z" />
            </svg>
          </button>
        </div>

        <div className="mb-6">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-text-secondary mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-4">
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 accent-brand cursor-pointer"
          />
          <span className="text-sm text-text-secondary w-10 text-right">{volume}%</span>
        </div>

        {/* Status */}
        <div className="mt-6 text-center">
          {isPlaying ? (
            <div className="flex items-center justify-center gap-2 text-brand">
              <div className="w-2 h-2 bg-brand rounded-full animate-pulse" />
              <span className="text-sm font-medium">Playing BVS Radio</span>
            </div>
          ) : (
            <span className="text-sm text-text-secondary">Click play to start the BVS library</span>
          )}
        </div>
      </div>
    </div>
  );
}
