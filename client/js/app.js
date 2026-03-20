// Main entry point — wires DOM to session/tools/media modules
import "./session.js";
import { startSession, stopSession, startTalking, setDom, checkAuthStatus, setSpotifyAuthenticated, setYtAuthenticated } from "./session.js";
import { youtubePlayer, spotifyPlayer } from "./media-players.js";
import { onSpotifyPlay } from "./session.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Gather DOM references
  const dom = {
    sessionStopped: document.getElementById("session-stopped"),
    sessionActive: document.getElementById("session-active"),
    connectionButtons: document.getElementById("connection-buttons"),
    startBtn: document.getElementById("start-session-btn"),
    talkBtn: document.getElementById("talk-btn"),
    disconnectBtn: document.getElementById("disconnect-btn"),
    youtubeContainer: document.querySelector("[data-testid='youtube-player']"),
    spotifyContainer: document.querySelector("[data-testid='spotify-player']"),
  };

  setDom(dom);

  // Start Session button
  dom.startBtn.addEventListener("click", async () => {
    if (dom.startBtn.dataset.activating === "true") return;
    dom.startBtn.dataset.activating = "true";
    dom.startBtn.style.backgroundColor = "#555";
    dom.startBtn.style.boxShadow = "none";
    dom.startBtn.querySelector(".btn-label").textContent = "Connecting...";

    try {
      await startSession();
      // Start Spotify polling if authenticated
      const { spotifyAuthenticated } = await fetch("/auth/spotify/status").then(r => r.json());
      if (spotifyAuthenticated) {
        spotifyPlayer.start();
      }
    } catch (err) {
      console.error("Failed to start session:", err);
      dom.startBtn.dataset.activating = "false";
      dom.startBtn.style.backgroundColor = "#4f8cff";
      dom.startBtn.style.boxShadow = "0 0 30px rgba(79, 140, 255, 0.4)";
      dom.startBtn.querySelector(".btn-label").textContent = "Start Session";
    }
  });

  // Talk button
  dom.talkBtn.addEventListener("click", () => startTalking());

  // Disconnect button
  dom.disconnectBtn.addEventListener("click", () => stopSession());

  // Initialize YouTube player
  youtubePlayer.init("yt-player-container", () => {});

  // Initialize Spotify player
  spotifyPlayer.init(
    () => {}, // onTrackChange
    (isPlaying) => {
      if (isPlaying) onSpotifyPlay();
    },
  );

  // YouTube player controls
  document.getElementById("yt-prev")?.addEventListener("click", () => youtubePlayer.previous());
  document.getElementById("yt-next")?.addEventListener("click", () => youtubePlayer.next());
  document.getElementById("yt-shuffle")?.addEventListener("click", () => youtubePlayer.shuffle(true));
  document.getElementById("yt-close")?.addEventListener("click", () => {
    youtubePlayer.destroy();
    const container = document.querySelector("[data-testid='youtube-player']");
    if (container) container.style.display = "none";
  });

  // Spotify player controls
  document.querySelector(".sp-prev")?.addEventListener("click", () => spotifyPlayer.previous());
  document.querySelector(".sp-play-pause")?.addEventListener("click", () => spotifyPlayer.togglePlayPause());
  document.querySelector(".sp-next")?.addEventListener("click", () => spotifyPlayer.next());
  document.querySelector(".sp-shuffle")?.addEventListener("click", () => spotifyPlayer.shuffle());

  // Auth logout handlers (exposed globally for inline onclick in dynamic HTML)
  window.__handleYouTubeLogout = () => {
    fetch("/auth/google/logout", { method: "POST" })
      .then(() => setYtAuthenticated(false))
      .catch(() => {});
  };
  window.__handleSpotifyLogout = () => {
    fetch("/auth/spotify/logout", { method: "POST" })
      .then(() => setSpotifyAuthenticated(false))
      .catch(() => {});
  };

  // Check auth status on load
  await checkAuthStatus();
});
