import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";

const POLL_INTERVAL_MS = 4000;

const SpotifyPlayer = forwardRef(function SpotifyPlayer(
  { onClose, onTrackChange, onPlayStateChange },
  ref,
) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPaused, setIsPaused] = useState(true);
  const lastTrackUriRef = useRef(null);
  const lastIsPlayingRef = useRef(null);

  const pollCurrentlyPlaying = useCallback(async () => {
    try {
      const res = await fetch("/spotify/currently-playing");
      if (!res.ok) return;
      const data = await res.json();

      if (!data || !data.name) {
        setCurrentTrack(null);
        if (lastIsPlayingRef.current !== false) {
          lastIsPlayingRef.current = false;
          setIsPaused(true);
          onPlayStateChange?.(false);
        }
        return;
      }

      const trackInfo = {
        name: data.name,
        artist: data.artist,
        album: data.album,
        albumArt: data.albumArt,
        uri: data.uri,
      };

      setCurrentTrack(trackInfo);
      setIsPaused(!data.playing);

      if (data.uri !== lastTrackUriRef.current) {
        lastTrackUriRef.current = data.uri;
        onTrackChange?.(trackInfo);
      }

      if (data.playing !== lastIsPlayingRef.current) {
        lastIsPlayingRef.current = data.playing;
        onPlayStateChange?.(data.playing);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [onTrackChange, onPlayStateChange]);

  useImperativeHandle(ref, () => ({
    pause: async () => {
      try {
        await fetch("/spotify/pause", { method: "PUT" });
        setIsPaused(true);
      } catch {}
    },
    resume: async () => {
      try {
        await fetch("/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        setIsPaused(false);
      } catch {}
    },
    next: async () => {
      try {
        await fetch("/spotify/next", { method: "POST" });
      } catch {}
    },
    previous: async () => {
      try {
        await fetch("/spotify/previous", { method: "POST" });
      } catch {}
    },
    shuffle: async () => {
      try {
        await fetch("/spotify/shuffle", { method: "PUT" });
      } catch {}
    },
  }));

  // Poll for currently playing track
  useEffect(() => {
    pollCurrentlyPlaying();
    const interval = setInterval(pollCurrentlyPlaying, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollCurrentlyPlaying]);

  if (!currentTrack) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold truncate">
          {currentTrack.name || "Now Playing"}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => ref.current?.previous()}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            ⏮
          </button>
          <button
            onClick={() => isPaused ? ref.current?.resume() : ref.current?.pause()}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            {isPaused ? "▶" : "⏸"}
          </button>
          <button
            onClick={() => ref.current?.next()}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            ⏭
          </button>
          <button
            onClick={() => ref.current?.shuffle()}
            className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
          >
            🔀
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 p-2 bg-gray-900 rounded-md">
        {currentTrack.albumArt && (
          <img
            src={currentTrack.albumArt}
            alt={currentTrack.album}
            className="w-14 h-14 rounded"
          />
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-white font-medium truncate">
            {currentTrack.name}
          </span>
          <span className="text-xs text-gray-400 truncate">
            {currentTrack.artist}
          </span>
          <span className="text-xs text-gray-500 truncate">
            {currentTrack.album}
          </span>
        </div>
      </div>
    </div>
  );
});

export default SpotifyPlayer;
