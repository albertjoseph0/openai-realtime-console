// WebRTC session management — extracted from React App.jsx
// Manages peer connection, data channel, microphone, and audio playback

import { initTools, resetTools } from "./tools.js";
import { youtubePlayer, spotifyPlayer } from "./media-players.js";

let peerConnection = null;
let audioElement = null;
let micTrack = null;
let dataChannel = null;
let isSessionActive = false;
let isTalking = false;
let spotifyAuthenticated = false;
let ytAuthenticated = false;

const events = [];

// DOM references (set once from app.js)
let dom = {};

export function setDom(refs) {
  dom = refs;
}

export function getState() {
  return { isSessionActive, isTalking, spotifyAuthenticated, ytAuthenticated };
}

export function setSpotifyAuthenticated(val) {
  spotifyAuthenticated = val;
  updateAuthButtons();
}

export function setYtAuthenticated(val) {
  ytAuthenticated = val;
  updateAuthButtons();
}

function updateAuthButtons() {
  if (!dom.connectionButtons) return;

  // YouTube button
  const ytBtn = dom.connectionButtons.querySelector("[data-auth='youtube']");
  if (ytBtn) {
    if (ytAuthenticated) {
      ytBtn.outerHTML = `<button data-testid="youtube-connected" data-auth="youtube" onclick="window.__handleYouTubeLogout()" class="px-5 py-3 rounded-full text-sm font-medium transition-colors" style="background-color: rgba(255, 0, 0, 0.15); color: #ff4444; border: 1px solid rgba(255, 0, 0, 0.3);">YouTube ✓</button>`;
    } else {
      ytBtn.outerHTML = `<a data-testid="connect-youtube" data-auth="youtube" href="/auth/google" class="px-5 py-3 rounded-full text-sm font-medium no-underline transition-colors" style="background-color: var(--color-surface); color: var(--color-text-muted); border: 1px solid #333;">Connect YouTube</a>`;
    }
  }

  // Spotify button
  const spBtn = dom.connectionButtons.querySelector("[data-auth='spotify']");
  if (spBtn) {
    if (spotifyAuthenticated) {
      spBtn.outerHTML = `<button data-testid="spotify-connected" data-auth="spotify" onclick="window.__handleSpotifyLogout()" class="px-5 py-3 rounded-full text-sm font-medium transition-colors" style="background-color: rgba(29, 185, 84, 0.15); color: #1db954; border: 1px solid rgba(29, 185, 84, 0.3);">Spotify ✓</button>`;
    } else {
      spBtn.outerHTML = `<a data-testid="connect-spotify" data-auth="spotify" href="/auth/spotify" class="px-5 py-3 rounded-full text-sm font-medium no-underline transition-colors" style="background-color: var(--color-surface); color: var(--color-text-muted); border: 1px solid #333;">Connect Spotify</a>`;
    }
  }
}

export async function startSession() {
  const tokenResponse = await fetch("/token");
  const data = await tokenResponse.json();
  const EPHEMERAL_KEY = data.value;
  const endpoint = data.endpoint;

  const pc = new RTCPeerConnection();

  audioElement = document.createElement("audio");
  audioElement.autoplay = true;
  pc.ontrack = (e) => (audioElement.srcObject = e.streams[0]);

  const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
  const track = ms.getTracks()[0];
  track.enabled = false;
  micTrack = track;
  pc.addTrack(track);

  const dc = pc.createDataChannel("oai-events");
  dataChannel = dc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResponse = await fetch(
    `${endpoint}/openai/v1/realtime/calls`,
    {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    },
  );

  const sdp = await sdpResponse.text();
  const answer = { type: "answer", sdp };
  await pc.setRemoteDescription(answer);

  peerConnection = pc;

  // Set up data channel event listeners
  dc.addEventListener("message", (e) => {
    const event = JSON.parse(e.data);
    if (!event.timestamp) {
      event.timestamp = new Date().toLocaleTimeString();
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      console.log("[USER SPEECH]", event.transcript);
    }
    if (event.type === "response.audio_transcript.done") {
      console.log("[AI RESPONSE]", event.transcript);
    }
    if (event.type === "response.done" && event.response?.output) {
      event.response.output.forEach((output) => {
        if (output.type === "function_call") {
          console.log(`[TOOL CALL] ${output.name}(${output.arguments})`);
        }
      });
    }

    events.unshift(event);
    // Notify tools of new events
    initTools.onEvent?.(event);
  });

  dc.addEventListener("open", () => {
    isSessionActive = true;
    events.length = 0;
    updateUI();
  });
}

export function startTalking() {
  if (isTalking) return;
  youtubePlayer.pause();
  spotifyPlayer.pause();
  if (micTrack) micTrack.enabled = true;
  isTalking = true;
  updateTalkButton();
}

export function stopTalking() {
  if (micTrack) micTrack.enabled = false;
  isTalking = false;
  updateTalkButton();
}

export function onMediaPlay() {
  if (micTrack) micTrack.enabled = false;
  isTalking = false;
  updateTalkButton();
}

export function onSpotifyPlay() {
  if (micTrack) micTrack.enabled = false;
  isTalking = false;
  updateTalkButton();
}

export function stopSession() {
  if (dataChannel) {
    dataChannel.close();
  }

  if (peerConnection) {
    peerConnection.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });
    peerConnection.close();
  }

  isSessionActive = false;
  isTalking = false;
  dataChannel = null;
  peerConnection = null;
  micTrack = null;
  resetTools();
  youtubePlayer.destroy();
  spotifyPlayer.stop();
  updateUI();
}

export function sendClientEvent(message) {
  if (dataChannel) {
    const timestamp = new Date().toLocaleTimeString();
    message.event_id = message.event_id || crypto.randomUUID();
    dataChannel.send(JSON.stringify(message));
    if (!message.timestamp) {
      message.timestamp = timestamp;
    }
    events.unshift(message);
  } else {
    console.error("Failed to send message - no data channel available", message);
  }
}

function updateTalkButton() {
  if (!dom.talkBtn) return;
  if (isTalking) {
    dom.talkBtn.style.backgroundColor = "var(--color-accent-red)";
    dom.talkBtn.style.animation = "pulse-glow 1.5s ease-in-out infinite";
    dom.talkBtn.style.boxShadow = "0 0 30px rgba(255, 68, 68, 0.5)";
    dom.talkBtn.querySelector(".btn-label").textContent = "Listening...";
  } else {
    dom.talkBtn.style.backgroundColor = "var(--color-accent-green)";
    dom.talkBtn.style.animation = "none";
    dom.talkBtn.style.boxShadow = "0 0 20px rgba(29, 185, 84, 0.3)";
    dom.talkBtn.querySelector(".btn-label").textContent = "Talk";
  }
}

function updateUI() {
  if (!dom.sessionStopped || !dom.sessionActive) return;

  if (isSessionActive) {
    dom.sessionStopped.style.display = "none";
    dom.sessionActive.style.display = "flex";
    dom.connectionButtons.style.display = "flex";
    // Re-enable start button for next time
    const startBtn = dom.sessionStopped.querySelector("[data-testid='start-session-btn']");
    if (startBtn) {
      startBtn.style.backgroundColor = "#4f8cff";
      startBtn.style.boxShadow = "0 0 30px rgba(79, 140, 255, 0.4)";
      startBtn.querySelector(".btn-label").textContent = "Start Session";
    }
    updateAuthButtons();
  } else {
    dom.sessionStopped.style.display = "flex";
    dom.sessionActive.style.display = "none";
    dom.connectionButtons.style.display = "none";
    // Hide media players
    dom.youtubeContainer.style.display = "none";
    dom.spotifyContainer.style.display = "none";
  }
}

// Check auth status on load
export async function checkAuthStatus() {
  try {
    const [spotifyRes, googleRes] = await Promise.all([
      fetch("/auth/spotify/status"),
      fetch("/auth/google/status"),
    ]);
    const spotifyData = await spotifyRes.json();
    const googleData = await googleRes.json();
    spotifyAuthenticated = spotifyData.authenticated;
    ytAuthenticated = googleData.authenticated;
  } catch {
    // Silently ignore
  }
}
