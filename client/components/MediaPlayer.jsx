import { useEffect, useRef, useState } from "react";

export default function MediaPlayer({ videoId, title, onClose }) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsReady(true);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => setIsReady(true);
  }, []);

  // Create or update player when videoId changes
  useEffect(() => {
    if (!isReady || !videoId) return;

    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      return;
    }

    playerRef.current = new window.YT.Player(containerRef.current, {
      height: "100%",
      width: "100%",
      videoId,
      playerVars: {
        playsinline: 1,
        autoplay: 1,
        rel: 0,
      },
    });
  }, [isReady, videoId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  if (!videoId) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold truncate">{title || "Now Playing"}</h3>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300"
        >
          ✕
        </button>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 rounded-md overflow-hidden bg-black"
        />
      </div>
    </div>
  );
}
