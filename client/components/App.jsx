import { useEffect, useRef, useState } from "react";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [isTalking, setIsTalking] = useState(false);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const micTrack = useRef(null);
  const mediaPlayerRef = useRef(null);
  const spotifyPlayerRef = useRef(null);
  const [spotifyAuthenticated, setSpotifyAuthenticated] = useState(false);
  const [ytAuthenticated, setYtAuthenticated] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    fetch("/auth/spotify/status")
      .then((r) => r.json())
      .then((data) => setSpotifyAuthenticated(data.authenticated))
      .catch(() => {});
    fetch("/auth/google/status")
      .then((r) => r.json())
      .then((data) => setYtAuthenticated(data.authenticated))
      .catch(() => {});
  }, []);

  async function startSession() {
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.value;
    const endpoint = data.endpoint;

    const pc = new RTCPeerConnection();

    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = ms.getTracks()[0];
    track.enabled = false;
    micTrack.current = track;
    pc.addTrack(track);

    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

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

    peerConnection.current = pc;
  }

  function startTalking() {
    if (isTalking) return;
    mediaPlayerRef.current?.pause();
    spotifyPlayerRef.current?.pause();
    if (micTrack.current) micTrack.current.enabled = true;
    setIsTalking(true);
  }

  function onMediaPlay() {
    if (micTrack.current) micTrack.current.enabled = false;
    setIsTalking(false);
  }

  function onSpotifyPlay() {
    if (micTrack.current) micTrack.current.enabled = false;
    setIsTalking(false);
  }

  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setIsTalking(false);
    setDataChannel(null);
    peerConnection.current = null;
    micTrack.current = null;
  }

  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error("Failed to send message - no data channel available", message);
    }
  }

  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
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

        setEvents((prev) => [event, ...prev]);
      });

      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  function handleYouTubeLogout() {
    fetch("/auth/google/logout", { method: "POST" })
      .then(() => setYtAuthenticated(false))
      .catch(() => {});
  }

  function handleSpotifyLogout() {
    fetch("/auth/spotify/logout", { method: "POST" })
      .then(() => setSpotifyAuthenticated(false))
      .catch(() => {});
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4">
      {/* Session controls — either start button or talk + disconnect */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="flex flex-col items-center gap-8">
          <SessionControls
            startSession={startSession}
            stopSession={stopSession}
            isSessionActive={isSessionActive}
            isTalking={isTalking}
            startTalking={startTalking}
          />

          {/* Connection buttons — only shown when session is active */}
          {isSessionActive && (
            <div className="flex gap-3" data-testid="connection-buttons">
              {ytAuthenticated ? (
                <button
                  data-testid="youtube-connected"
                  onClick={handleYouTubeLogout}
                  className="px-5 py-3 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: "rgba(255, 0, 0, 0.15)",
                    color: "#ff4444",
                    border: "1px solid rgba(255, 0, 0, 0.3)",
                  }}
                >
                  YouTube ✓
                </button>
              ) : (
                <a
                  data-testid="connect-youtube"
                  href="/auth/google"
                  className="px-5 py-3 rounded-full text-sm font-medium no-underline transition-colors"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    border: "1px solid #333",
                  }}
                >
                  Connect YouTube
                </a>
              )}

              {spotifyAuthenticated ? (
                <button
                  data-testid="spotify-connected"
                  onClick={handleSpotifyLogout}
                  className="px-5 py-3 rounded-full text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: "rgba(29, 185, 84, 0.15)",
                    color: "#1db954",
                    border: "1px solid rgba(29, 185, 84, 0.3)",
                  }}
                >
                  Spotify ✓
                </button>
              ) : (
                <a
                  data-testid="connect-spotify"
                  href="/auth/spotify"
                  className="px-5 py-3 rounded-full text-sm font-medium no-underline transition-colors"
                  style={{
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text-muted)",
                    border: "1px solid #333",
                  }}
                >
                  Connect Spotify
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media players — shown at bottom when content is playing */}
      <div className="w-full flex flex-col items-center gap-4 pb-4">
        <ToolPanel
          sendClientEvent={sendClientEvent}
          events={events}
          isSessionActive={isSessionActive}
          mediaPlayerRef={mediaPlayerRef}
          onMediaPlay={onMediaPlay}
          spotifyPlayerRef={spotifyPlayerRef}
          spotifyAuthenticated={spotifyAuthenticated}
          setSpotifyAuthenticated={setSpotifyAuthenticated}
          onSpotifyPlay={onSpotifyPlay}
          ytAuthenticated={ytAuthenticated}
          setYtAuthenticated={setYtAuthenticated}
        />
      </div>
    </div>
  );
}
