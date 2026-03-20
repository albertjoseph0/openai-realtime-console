import { useState } from "react";
import { Mic, Power } from "react-feather";

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;
    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-6">
      <button
        data-testid="start-session-btn"
        onClick={handleStartSession}
        className="w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 text-white text-lg font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          backgroundColor: isActivating ? "#555" : "#4f8cff",
          boxShadow: isActivating ? "none" : "0 0 30px rgba(79, 140, 255, 0.4)",
        }}
      >
        <Power size={32} />
        {isActivating ? "Connecting..." : "Start Session"}
      </button>
    </div>
  );
}

function SessionActive({ stopSession, isTalking, startTalking }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        data-testid="talk-btn"
        onClick={startTalking}
        className="w-32 h-32 rounded-full flex flex-col items-center justify-center gap-2 text-white text-base font-semibold transition-all duration-200 active:scale-95"
        style={{
          backgroundColor: isTalking ? "var(--color-accent-red)" : "var(--color-accent-green)",
          animation: isTalking ? "pulse-glow 1.5s ease-in-out infinite" : "none",
          boxShadow: isTalking
            ? "0 0 30px rgba(255, 68, 68, 0.5)"
            : "0 0 20px rgba(29, 185, 84, 0.3)",
        }}
      >
        <Mic size={28} />
        {isTalking ? "Listening..." : "Talk"}
      </button>
      <button
        data-testid="disconnect-btn"
        onClick={stopSession}
        className="text-sm px-4 py-2 rounded-full transition-colors"
        style={{
          color: "var(--color-text-muted)",
          backgroundColor: "var(--color-surface)",
        }}
      >
        Disconnect
      </button>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  isSessionActive,
  isTalking,
  startTalking,
}) {
  return isSessionActive ? (
    <SessionActive
      stopSession={stopSession}
      isTalking={isTalking}
      startTalking={startTalking}
    />
  ) : (
    <SessionStopped startSession={startSession} />
  );
}
