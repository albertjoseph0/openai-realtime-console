import { useEffect, useState } from "react";
import MediaPlayer from "./MediaPlayer";

const functionDescription = `
Call this function when a user asks for a color palette.
`;

const playMediaDescription = `
Call this function when a user asks to play a song, music, video, or playlist. 
Extract the song name, artist, or search query from their request.
`;

const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    tools: [
      {
        type: "function",
        name: "display_color_palette",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            theme: {
              type: "string",
              description: "Description of the theme for the color scheme.",
            },
            colors: {
              type: "array",
              description: "Array of five hex color codes based on the theme.",
              items: {
                type: "string",
                description: "Hex color code",
              },
            },
          },
          required: ["theme", "colors"],
        },
      },
      {
        type: "function",
        name: "play_media",
        description: playMediaDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            query: {
              type: "string",
              description:
                "Search query for the song, video, or playlist. Include artist name if mentioned.",
            },
          },
          required: ["query"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

function FunctionCallOutput({ functionCallOutput }) {
  const { theme, colors } = JSON.parse(functionCallOutput.arguments);

  const colorBoxes = colors.map((color) => (
    <div
      key={color}
      className="w-full h-16 rounded-md flex items-center justify-center border border-gray-200"
      style={{ backgroundColor: color }}
    >
      <p className="text-sm font-bold text-black bg-slate-100 rounded-md p-2 border border-black">
        {color}
      </p>
    </div>
  ));

  return (
    <div className="flex flex-col gap-2">
      <p>Theme: {theme}</p>
      {colorBoxes}
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
  mediaPlayerRef,
  onMediaPlay,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);

  useEffect(() => {
    if (!events || events.length === 0) return;

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        if (
          output.type === "function_call" &&
          output.name === "display_color_palette"
        ) {
          setFunctionCallOutput(output);
          setTimeout(() => {
            sendClientEvent({
              type: "response.create",
              response: {
                instructions: `
                ask for feedback about the color palette - don't repeat 
                the colors, just ask if they like the colors.
              `,
              },
            });
          }, 500);
        }

        if (
          output.type === "function_call" &&
          output.name === "play_media"
        ) {
          handlePlayMedia(output);
        }
      });
    }
  }, [events]);

  async function handlePlayMedia(output) {
    const { query } = JSON.parse(output.arguments);

    try {
      const response = await fetch(
        `/youtube/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();

      if (data.found) {
        setCurrentVideo({ videoId: data.videoId, title: data.title });
        onMediaPlay();

        // Send function result back to the model
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: output.call_id,
            output: JSON.stringify({
              status: "playing",
              title: data.title,
              channel: data.channelTitle,
            }),
          },
        });
      } else {
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: output.call_id,
            output: JSON.stringify({
              status: "not_found",
              message: `No results found for "${query}"`,
            }),
          },
        });
      }

      setTimeout(() => {
        sendClientEvent({ type: "response.create" });
      }, 500);
    } catch (error) {
      console.error("YouTube search failed:", error);
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: output.call_id,
          output: JSON.stringify({
            status: "error",
            message: "Failed to search YouTube",
          }),
        },
      });
      setTimeout(() => {
        sendClientEvent({ type: "response.create" });
      }, 500);
    }
  }

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
      setCurrentVideo(null);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Media Player</h2>
        {isSessionActive ? (
          currentVideo ? (
            <MediaPlayer
              ref={mediaPlayerRef}
              videoId={currentVideo.videoId}
              title={currentVideo.title}
              onClose={() => setCurrentVideo(null)}
            />
          ) : (
            <p>Ask to play a song or video...</p>
          )
        ) : (
          <p>Start the session to use this tool...</p>
        )}
      </div>
      <div className="bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Color Palette Tool</h2>
        {isSessionActive
          ? (
            functionCallOutput
              ? <FunctionCallOutput functionCallOutput={functionCallOutput} />
              : <p>Ask for advice on a color palette...</p>
          )
          : <p>Start the session to use this tool...</p>}
      </div>
    </section>
  );
}
