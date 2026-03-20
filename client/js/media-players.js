// YouTube IFrame player and Spotify "now playing" — extracted from React components

// ── YouTube Player ──

const youtubePlayer = {
  _player: null,
  _container: null,
  _ready: false,
  _playerReady: false,
  _hasLoadedMedia: false,
  _onPlay: null,
  _pendingLoad: null,
  _createOnReady: false,
  _apiReadyHandlerInstalled: false,
  _autoplayPending: false,
  _autoplayRetryCount: 0,
  _playKickTimers: [],
  _gestureUnlockTimer: null,
  _ignorePlayUntilTs: 0,
  _audioUnlockContext: null,

  init(containerId, onPlay) {
    this._container = document.getElementById(containerId);
    this._onPlay = onPlay;
    if (window.YT && window.YT.Player) {
      this._ready = true;
      if (this._createOnReady) this._ensurePlayer();
      return;
    }
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    if (!this._apiReadyHandlerInstalled) {
      const previousReadyHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReadyHandler === "function") previousReadyHandler();
        this._ready = true;
        if (this._createOnReady) this._ensurePlayer();
        this._flushPendingLoad();
      };
      this._apiReadyHandlerInstalled = true;
    }
  },

  prewarm() {
    this._createOnReady = true;
    if (this._ready) this._ensurePlayer();
  },

  unlockFromGesture() {
    this.prewarm();
    this._unlockAudioContext();
    if (!this._playerReady || this._hasLoadedMedia || this._pendingLoad) return;
    this._runGestureUnlockBootstrap();
  },

  load(videoId, playlistId, title) {
    if (!videoId && !playlistId) return false;

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

    this._pendingLoad = { videoId, playlistId };
    this._createOnReady = true;

    if (!this._ready) return true;
    this._ensurePlayer();
    this._flushPendingLoad();
    return true;
  },

  _ensurePlayer() {
    if (this._player || !this._ready || !this._container) return;

    const playerVars = { playsinline: 1, autoplay: 1, rel: 0 };
    const config = {
      height: "100%",
      width: "100%",
      playerVars,
      events: {
        onReady: () => this._onPlayerReady(),
        onStateChange: (event) => this._onPlayerStateChange(event),
      },
    };

    this._player = new window.YT.Player(this._container, config);
  },

  _onPlayerReady() {
    this._playerReady = true;
    const iframe = this._player?.getIframe?.();
    if (iframe) {
      iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    }
    this._flushPendingLoad();
  },

  _onPlayerStateChange(event) {
    const state = event?.data;
    const playerState = window.YT?.PlayerState;
    if (!playerState) return;

    if (state === playerState.PLAYING) {
      if (Date.now() < this._ignorePlayUntilTs) return;
      this._autoplayPending = false;
      this._autoplayRetryCount = 0;
      this._clearPlayKickTimers();
      this._onPlay?.();
      return;
    }

    if (
      this._autoplayPending
      && this._autoplayRetryCount < 2
      && (
        state === playerState.UNSTARTED
        || state === playerState.CUED
        || state === playerState.PAUSED
      )
    ) {
      this._autoplayRetryCount += 1;
      this._tryPlayVideo();
    }
  },

  _flushPendingLoad() {
    if (!this._pendingLoad || !this._player || !this._playerReady) return;
    const { videoId, playlistId } = this._pendingLoad;
    this._pendingLoad = null;
    this._hasLoadedMedia = true;

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

    this._autoplayPending = true;
    this._autoplayRetryCount = 0;
    this._queuePlayKickBurst();
  },

  _tryPlayVideo() {
    try {
      this._player?.playVideo?.();
    } catch (error) {
      console.warn("[YouTube] playVideo() failed:", error);
    }
  },

  _queuePlayKickBurst() {
    if (!this._player || !this._playerReady) return;
    this._clearPlayKickTimers();
    this._tryPlayVideo();
    this._playKickTimers = [
      setTimeout(() => this._tryPlayVideo(), 250),
      setTimeout(() => this._tryPlayVideo(), 900),
      setTimeout(() => this._tryPlayVideo(), 1700),
    ];
  },

  _clearPlayKickTimers() {
    this._playKickTimers.forEach((timerId) => clearTimeout(timerId));
    this._playKickTimers = [];
  },

  _unlockAudioContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!this._audioUnlockContext) {
      this._audioUnlockContext = new AudioContextCtor();
    }
    if (this._audioUnlockContext.state === "suspended") {
      this._audioUnlockContext.resume().catch((error) => {
        console.warn("[YouTube] audio context resume failed:", error);
      });
    }
  },

  _runGestureUnlockBootstrap() {
    if (!this._player || !this._playerReady) return;
    this._ignorePlayUntilTs = Date.now() + 1500;
    if (this._gestureUnlockTimer) {
      clearTimeout(this._gestureUnlockTimer);
      this._gestureUnlockTimer = null;
    }

    // A short hidden play/stop sequence inside the Talk click gesture improves first-play reliability on iOS.
    const wasMuted = this._player.isMuted?.() ?? false;
    try {
      this._player.mute?.();
      this._player.loadVideoById("M7lc1UVf-VE");
      this._player.playVideo?.();
      this._gestureUnlockTimer = setTimeout(() => {
        try {
          this._player?.stopVideo?.();
          if (!wasMuted) this._player?.unMute?.();
        } catch (error) {
          console.warn("[YouTube] gesture unlock cleanup failed:", error);
        }
      }, 160);
    } catch (error) {
      console.warn("[YouTube] gesture unlock failed:", error);
    }
  },

  pause() {
    this._autoplayPending = false;
    this._autoplayRetryCount = 0;
    this._clearPlayKickTimers();
    try {
      this._player?.pauseVideo?.();
    } catch (error) {
      console.warn("[YouTube] pauseVideo() failed:", error);
    }
  },
  play() {
    this._autoplayPending = true;
    this._autoplayRetryCount = 0;
    this._queuePlayKickBurst();
  },
  next() {
    this._autoplayPending = true;
    this._autoplayRetryCount = 0;
    try {
      this._player?.nextVideo?.();
    } catch (error) {
      console.warn("[YouTube] nextVideo() failed:", error);
    }
    this._queuePlayKickBurst();
  },
  previous() {
    this._autoplayPending = true;
    this._autoplayRetryCount = 0;
    try {
      this._player?.previousVideo?.();
    } catch (error) {
      console.warn("[YouTube] previousVideo() failed:", error);
    }
    this._queuePlayKickBurst();
  },
  shuffle(on = true) {
    try {
      this._player?.setShuffle?.(on);
    } catch (error) {
      console.warn("[YouTube] setShuffle() failed:", error);
    }
  },
  destroy() {
    this._clearPlayKickTimers();
    if (this._gestureUnlockTimer) {
      clearTimeout(this._gestureUnlockTimer);
      this._gestureUnlockTimer = null;
    }
    this._autoplayPending = false;
    this._autoplayRetryCount = 0;
    this._pendingLoad = null;
    this._playerReady = false;
    this._hasLoadedMedia = false;
    this._ignorePlayUntilTs = 0;
    try {
      if (this._player?.destroy) {
        this._player.destroy();
      }
    } catch (error) {
      console.warn("[YouTube] destroy() failed:", error);
    }
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
