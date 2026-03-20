// YouTube IFrame player and Spotify "now playing" — extracted from React components

// ── YouTube Player ──

const youtubePlayer = {
  _player: null,
  _container: null,
  _ready: false,
  _onPlay: null,

  init(containerId, onPlay) {
    this._container = document.getElementById(containerId);
    this._onPlay = onPlay;
    if (window.YT && window.YT.Player) {
      this._ready = true;
      return;
    }
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => {
      this._ready = true;
    };
  },

  load(videoId, playlistId, title) {
    if (!this._ready || (!videoId && !playlistId)) return;

    const titleEl = document.getElementById("yt-title");
    if (titleEl) titleEl.textContent = title || "Now Playing";

    const playlistControls = document.getElementById("yt-playlist-controls");
    if (playlistControls) {
      playlistControls.style.display = playlistId ? "flex" : "none";
    }

    const wrapper = document.getElementById("youtube-player-wrapper");
    if (wrapper) wrapper.style.display = "block";

    // Show the container
    const outer = document.querySelector("[data-testid='youtube-player']");
    if (outer) outer.style.display = "block";

    if (this._player) {
      if (playlistId) {
        this._player.loadPlaylist({
          listType: "playlist",
          list: playlistId,
          index: 0,
          startSeconds: 0,
        });
      } else {
        this._player.loadVideoById(videoId);
      }
      return;
    }

    const playerVars = { playsinline: 1, autoplay: 1, rel: 0 };
    const config = { height: "100%", width: "100%", playerVars };

    if (playlistId) {
      playerVars.listType = "playlist";
      playerVars.list = playlistId;
    } else {
      config.videoId = videoId;
    }

    this._player = new window.YT.Player(this._container, config);
  },

  pause() {
    try { this._player?.pauseVideo(); } catch {}
  },
  play() {
    try { this._player?.playVideo(); } catch {}
  },
  next() {
    try { this._player?.nextVideo(); } catch {}
  },
  previous() {
    try { this._player?.previousVideo(); } catch {}
  },
  shuffle(on = true) {
    try { this._player?.setShuffle(on); } catch {}
  },
  destroy() {
    try {
      if (this._player?.destroy) {
        this._player.destroy();
      }
    } catch {}
    this._player = null;
  },
};

// ── Spotify Player ──

const POLL_INTERVAL_MS = 4000;

const spotifyPlayer = {
  _interval: null,
  _currentTrack: null,
  _isPaused: true,
  _lastTrackUri: null,
  _lastIsPlaying: null,
  _onTrackChange: null,
  _onPlayStateChange: null,

  init(onTrackChange, onPlayStateChange) {
    this._onTrackChange = onTrackChange;
    this._onPlayStateChange = onPlayStateChange;
  },

  start() {
    this._poll();
    this._interval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  },

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._currentTrack = null;
    this._isPaused = true;
    this._lastTrackUri = null;
    this._lastIsPlaying = null;
    this._updateDisplay();
  },

  async _poll() {
    try {
      const res = await fetch("/spotify/currently-playing");
      if (!res.ok) return;
      const data = await res.json();

      if (!data || !data.name) {
        this._currentTrack = null;
        if (this._lastIsPlaying !== false) {
          this._lastIsPlaying = false;
          this._isPaused = true;
          this._onPlayStateChange?.(false);
        }
        this._updateDisplay();
        return;
      }

      const trackInfo = {
        name: data.name,
        artist: data.artist,
        album: data.album,
        albumArt: data.albumArt,
        uri: data.uri,
      };

      this._currentTrack = trackInfo;
      this._isPaused = !data.playing;

      if (data.uri !== this._lastTrackUri) {
        this._lastTrackUri = data.uri;
        this._onTrackChange?.(trackInfo);
      }

      if (data.playing !== this._lastIsPlaying) {
        this._lastIsPlaying = data.playing;
        this._onPlayStateChange?.(data.playing);
      }

      this._updateDisplay();
    } catch {
      // Silently ignore polling errors
    }
  },

  _updateDisplay() {
    const container = document.querySelector("[data-testid='spotify-player']");
    if (!container) return;

    if (!this._currentTrack) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    const track = this._currentTrack;

    const titleEl = container.querySelector(".sp-title");
    if (titleEl) titleEl.textContent = track.name || "Now Playing";

    const playPauseBtn = container.querySelector(".sp-play-pause");
    if (playPauseBtn) playPauseBtn.textContent = this._isPaused ? "▶" : "⏸";

    const artEl = container.querySelector(".sp-album-art");
    if (artEl && track.albumArt) {
      artEl.src = track.albumArt;
      artEl.alt = track.album;
      artEl.style.display = "block";
    } else if (artEl) {
      artEl.style.display = "none";
    }

    const nameEl = container.querySelector(".sp-track-name");
    if (nameEl) nameEl.textContent = track.name;

    const artistEl = container.querySelector(".sp-artist");
    if (artistEl) artistEl.textContent = track.artist;

    const albumEl = container.querySelector(".sp-album");
    if (albumEl) albumEl.textContent = track.album;
  },

  async pause() {
    try {
      await fetch("/spotify/pause", { method: "PUT" });
      this._isPaused = true;
      this._updateDisplay();
    } catch {}
  },

  async resume() {
    try {
      await fetch("/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      this._isPaused = false;
      this._updateDisplay();
    } catch {}
  },

  async next() {
    try { await fetch("/spotify/next", { method: "POST" }); } catch {}
  },

  async previous() {
    try { await fetch("/spotify/previous", { method: "POST" }); } catch {}
  },

  async shuffle() {
    try { await fetch("/spotify/shuffle", { method: "PUT" }); } catch {}
  },

  togglePlayPause() {
    if (this._isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  },
};

export { youtubePlayer, spotifyPlayer };
