'use client';

import React, { useState, useRef, useEffect } from 'react';

interface RadioPlayerProps {
  streamUrl?: string;
  stationName?: string;
}

export default function RadioPlayer({ 
  streamUrl = "https://stream.bvsradio.com/stream" // TODO: replace with real stream URL, 
  stationName = "BVS Radio Live" 
}: RadioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        setError(null);
        
        // Try to play
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Playback error:", err);
      setError("Failed to play stream. Check the stream URL or try again.");
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

  // Handle stream errors
  const handleError = () => {
    setError("Stream error. The station may be offline or the URL is incorrect.");
    setIsPlaying(false);
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <audio 
        ref={audioRef} 
        src={streamUrl} 
        preload="none"
        onError={handleError}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Player Card */}
      <div className="bg-bg-card/80 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
        {/* Station Info */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-text-primary">{stationName}</h2>
          <p className="text-text-secondary text-sm mt-1">24/7 Live Stream</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Play Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={togglePlay}
            disabled={isLoading}
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
              <span className="text-sm font-medium">LIVE • Streaming</span>
            </div>
          ) : (
            <span className="text-sm text-text-secondary">Click play to start streaming</span>
          )}
        </div>
      </div>
    </div>
  );
}
