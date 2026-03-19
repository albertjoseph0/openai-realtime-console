import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const MediaPlayer = forwardRef(function MediaPlayer(
  { videoId, playlistId, title, onClose },
  ref,
) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useImperativeHandle(ref, () => ({
    pause: () => {
      try { playerRef.current?.pauseVideo(); } catch {}
    },
    play: () => {
      try { playerRef.current?.playVideo(); } catch {}
    },
    next: () => {
      try { playerRef.current?.nextVideo(); } catch {}
    },
    previous: () => {
      try { playerRef.current?.previousVideo(); } catch {}
    },
    shuffle: (on = true) => {
      try { playerRef.current?.setShuffle(on); } catch {}
    },
  }));

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

  // Create or update player when videoId or playlistId changes
  useEffect(() => {
    if (!isReady || (!videoId && !playlistId)) return;

    // If player already exists, update it
    if (playerRef.current) {
      if (playlistId) {
        playerRef.current.loadPlaylist({
          listType: "playlist",
          list: playlistId,
          index: 0,
          startSeconds: 0,
        });
      } else {
        playerRef.current.loadVideoById(videoId);
      }
      return;
    }

    // Create new player
    const playerVars = { playsinline: 1, autoplay: 1, rel: 0 };
    const config = { height: "100%", width: "100%", playerVars };

    if (playlistId) {
      playerVars.listType = "playlist";
      playerVars.list = playlistId;
    } else {
      config.videoId = videoId;
    }

    playerRef.current = new window.YT.Player(containerRef.current, config);
  }, [isReady, videoId, playlistId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, []);

  if (!videoId && !playlistId) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold truncate">
          {title || "Now Playing"}
        </h3>
        <div className="flex gap-1">
          {playlistId && (
            <>
              <button
                onClick={() => ref.current?.previous()}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              >
                ⏮
              </button>
              <button
                onClick={() => ref.current?.next()}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              >
                ⏭
              </button>
              <button
                onClick={() => ref.current?.shuffle(true)}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              >
                🔀
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <div
          ref={containerRef}
          className="absolute inset-0 rounded-md overflow-hidden bg-black"
        />
      </div>
    </div>
  );
});

export default MediaPlayer;
