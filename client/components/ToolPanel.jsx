import { useEffect, useState } from "react";
import MediaPlayer from "./MediaPlayer";
import SpotifyPlayer from "./SpotifyPlayer";

const functionDescription = `
Call this function when a user asks for a color palette.
`;

const playMediaDescription = `
Call this function when a user asks to play a specific song, music, or video. 
Extract the song name, artist, or search query from their request.
`;

const playPlaylistDescription = `
Call this function when a user asks to play a playlist.
Extract the playlist name or description from their request.
`;

const playMyPlaylistDescription = `
Call this function when a user asks to play one of their own personal YouTube playlists.
This requires the user to be signed in with YouTube. Extract the playlist name from their request.
`;

const playLikedVideosDescription = `
Call this function when a user asks to play their liked videos or favorites from YouTube.
This requires the user to be signed in with YouTube.
`;

const listMyPlaylistsDescription = `
Call this function when a user asks to see or list their YouTube playlists.
This requires the user to be signed in with YouTube.
`;

// Spotify tool descriptions
const spotifyPlayTrackDescription = `
Call this function when a user asks to play a specific song or track on Spotify.
Extract the song name, artist, or search query from their request.
The user may say things like "play X on Spotify" or "use Spotify to play X".
`;

const spotifyPlayPlaylistDescription = `
Call this function when a user asks to play a playlist on Spotify.
Extract the playlist name or description from their request.
`;

const spotifyPlayMyPlaylistDescription = `
Call this function when a user asks to play one of their own personal Spotify playlists.
This requires the user to be signed in with Spotify. Extract the playlist name from their request.
`;

const spotifyNextDescription = `Skip to the next track on Spotify.`;
const spotifyPreviousDescription = `Go back to the previous track on Spotify.`;
const spotifyPauseDescription = `Pause or resume Spotify playback.`;
const spotifyShuffleDescription = `Toggle shuffle mode on Spotify.`;

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
                "Search query for the song or video. Include artist name if mentioned.",
            },
          },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "play_playlist",
        description: playPlaylistDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            query: {
              type: "string",
              description:
                "Name or description of the playlist to search for.",
            },
          },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "next_track",
        description: "Skip to the next track in the current playlist.",
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "previous_track",
        description: "Go back to the previous track in the current playlist.",
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "shuffle_playlist",
        description: "Shuffle the current playlist so tracks play in random order.",
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "play_my_playlist",
        description: playMyPlaylistDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            playlist_name: {
              type: "string",
              description:
                "Name or partial name of the user's personal playlist to play.",
            },
          },
          required: ["playlist_name"],
        },
      },
      {
        type: "function",
        name: "play_liked_videos",
        description: playLikedVideosDescription,
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "list_my_playlists",
        description: listMyPlaylistsDescription,
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "spotify_play_track",
        description: spotifyPlayTrackDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            query: {
              type: "string",
              description:
                "Search query for the song or track. Include artist name if mentioned.",
            },
          },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "spotify_play_playlist",
        description: spotifyPlayPlaylistDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            query: {
              type: "string",
              description:
                "Name or description of the Spotify playlist to search for.",
            },
          },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "spotify_play_my_playlist",
        description: spotifyPlayMyPlaylistDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            playlist_name: {
              type: "string",
              description:
                "Name or partial name of the user's personal Spotify playlist to play.",
            },
          },
          required: ["playlist_name"],
        },
      },
      {
        type: "function",
        name: "spotify_next_track",
        description: spotifyNextDescription,
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "spotify_previous_track",
        description: spotifyPreviousDescription,
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "spotify_pause",
        description: spotifyPauseDescription,
        parameters: { type: "object", strict: true, properties: {} },
      },
      {
        type: "function",
        name: "spotify_shuffle",
        description: spotifyShuffleDescription,
        parameters: { type: "object", strict: true, properties: {} },
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
  spotifyPlayerRef,
  spotifyAuthenticated,
  setSpotifyAuthenticated,
  onSpotifyPlay,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [ytAuthenticated, setYtAuthenticated] = useState(false);
  const [spotifyTrack, setSpotifyTrack] = useState(null);

  // Resolve a working Spotify device ID from the user's available devices
  async function resolveSpotifyDeviceId() {
    try {
      const res = await fetch("/spotify/devices");
      const data = await res.json();
      console.log("[SPOTIFY] Available devices:", data.devices);
      const active = data.devices?.find((d) => d.is_active);
      const deviceId = active?.id || data.devices?.[0]?.id || null;
      console.log("[SPOTIFY] Using device:", deviceId);
      return deviceId;
    } catch {
      return null;
    }
  }

  // Check YouTube auth status on mount
  useEffect(() => {
    fetch("/auth/google/status")
      .then((r) => r.json())
      .then((data) => setYtAuthenticated(data.authenticated))
      .catch(() => {});
  }, []);

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

        if (
          output.type === "function_call" &&
          output.name === "play_playlist"
        ) {
          handlePlayPlaylist(output);
        }

        if (
          output.type === "function_call" &&
          ["next_track", "previous_track", "shuffle_playlist"].includes(output.name)
        ) {
          handlePlaybackControl(output);
        }

        if (
          output.type === "function_call" &&
          output.name === "play_my_playlist"
        ) {
          handlePlayMyPlaylist(output);
        }

        if (
          output.type === "function_call" &&
          output.name === "play_liked_videos"
        ) {
          handlePlayLikedVideos(output);
        }

        if (
          output.type === "function_call" &&
          output.name === "list_my_playlists"
        ) {
          handleListMyPlaylists(output);
        }

        if (
          output.type === "function_call" &&
          output.name === "spotify_play_track"
        ) {
          handleSpotifyPlayTrack(output);
        }

        if (
          output.type === "function_call" &&
          output.name === "spotify_play_playlist"
        ) {
          handleSpotifyPlayPlaylist(output);
        }

        if (
          output.type === "function_call" &&
          output.name === "spotify_play_my_playlist"
        ) {
          handleSpotifyPlayMyPlaylist(output);
        }

        if (
          output.type === "function_call" &&
          ["spotify_next_track", "spotify_previous_track", "spotify_pause", "spotify_shuffle"].includes(output.name)
        ) {
          handleSpotifyPlaybackControl(output);
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

  async function handlePlayPlaylist(output) {
    const { query } = JSON.parse(output.arguments);

    try {
      const response = await fetch(
        `/youtube/playlists/search?q=${encodeURIComponent(query)}`,
      );
      const data = await response.json();

      if (data.found) {
        setCurrentVideo({
          playlistId: data.playlistId,
          title: data.title,
        });
        onMediaPlay();

        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: output.call_id,
            output: JSON.stringify({
              status: "playing",
              title: data.title,
              channel: data.channelTitle,
              type: "playlist",
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
              message: `No playlist found for "${query}"`,
            }),
          },
        });
      }

      setTimeout(() => {
        sendClientEvent({ type: "response.create" });
      }, 500);
    } catch (error) {
      console.error("YouTube playlist search failed:", error);
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: output.call_id,
          output: JSON.stringify({
            status: "error",
            message: "Failed to search YouTube playlists",
          }),
        },
      });
      setTimeout(() => {
        sendClientEvent({ type: "response.create" });
      }, 500);
    }
  }

  function handlePlaybackControl(output) {
    const actions = {
      next_track: () => mediaPlayerRef.current?.next(),
      previous_track: () => mediaPlayerRef.current?.previous(),
      shuffle_playlist: () => mediaPlayerRef.current?.shuffle(true),
    };

    const action = actions[output.name];
    const hasMedia = !!currentVideo;

    if (hasMedia && action) {
      action();
      onMediaPlay();
    }

    sendClientEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: output.call_id,
        output: JSON.stringify({
          status: hasMedia ? "done" : "no_media",
          action: output.name,
          message: hasMedia
            ? `${output.name} executed successfully`
            : "No media is currently playing",
        }),
      },
    });

    setTimeout(() => {
      sendClientEvent({ type: "response.create" });
    }, 500);
  }

  async function handlePlayMyPlaylist(output) {
    const { playlist_name } = JSON.parse(output.arguments);

    if (!ytAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with YouTube first using the button in the Media Player panel.",
      });
      return;
    }

    try {
      const response = await fetch("/youtube/my/playlists");
      if (response.status === 401) {
        setYtAuthenticated(false);
        sendFunctionResult(output.call_id, {
          status: "not_authenticated",
          message: "YouTube session expired. Please sign in again.",
        });
        return;
      }

      const data = await response.json();
      const searchLower = playlist_name.toLowerCase();
      const match = data.playlists?.find((p) =>
        p.title.toLowerCase().includes(searchLower),
      );

      if (match) {
        setCurrentVideo({ playlistId: match.id, title: match.title });
        onMediaPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          title: match.title,
          type: "playlist",
          itemCount: match.itemCount,
        });
      } else {
        const available = (data.playlists || []).map((p) => p.title).slice(0, 10);
        sendFunctionResult(output.call_id, {
          status: "not_found",
          message: `No playlist matching "${playlist_name}" found.`,
          available_playlists: available,
        });
      }
    } catch (error) {
      console.error("Play my playlist failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: "Failed to fetch your playlists.",
      });
    }

    setTimeout(() => {
      sendClientEvent({ type: "response.create" });
    }, 500);
  }

  async function handlePlayLikedVideos(output) {
    if (!ytAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with YouTube first using the button in the Media Player panel.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
      return;
    }

    try {
      const response = await fetch("/youtube/my/liked");
      if (response.status === 401) {
        setYtAuthenticated(false);
        sendFunctionResult(output.call_id, {
          status: "not_authenticated",
          message: "YouTube session expired. Please sign in again.",
        });
        setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
        return;
      }

      const data = await response.json();
      if (data.videos && data.videos.length > 0) {
        setCurrentVideo({ playlistId: "LL", title: "Liked Videos" });
        onMediaPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          title: "Liked Videos",
          type: "playlist",
          videoCount: data.videos.length,
        });
      } else {
        sendFunctionResult(output.call_id, {
          status: "empty",
          message: "No liked videos found.",
        });
      }
    } catch (error) {
      console.error("Play liked videos failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: "Failed to fetch liked videos.",
      });
    }

    setTimeout(() => {
      sendClientEvent({ type: "response.create" });
    }, 500);
  }

  async function handleListMyPlaylists(output) {
    if (!ytAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with YouTube first using the button in the Media Player panel.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
      return;
    }

    try {
      const response = await fetch("/youtube/my/playlists");
      if (response.status === 401) {
        setYtAuthenticated(false);
        sendFunctionResult(output.call_id, {
          status: "not_authenticated",
          message: "YouTube session expired. Please sign in again.",
        });
        setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
        return;
      }

      const data = await response.json();
      sendFunctionResult(output.call_id, {
        status: "success",
        playlists: (data.playlists || []).map((p) => ({
          title: p.title,
          itemCount: p.itemCount,
        })),
      });
    } catch (error) {
      console.error("List playlists failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: "Failed to fetch your playlists.",
      });
    }

    setTimeout(() => {
      sendClientEvent({ type: "response.create" });
    }, 500);
  }

  // ── Spotify handlers ──

  async function handleSpotifyPlayTrack(output) {
    const { query } = JSON.parse(output.arguments);

    if (!spotifyAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with Spotify first using the button in the Spotify panel.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
      return;
    }

    try {
      const response = await fetch(
        `/spotify/search?q=${encodeURIComponent(query)}&type=track`,
      );
      if (response.status === 401) {
        setSpotifyAuthenticated(false);
        sendFunctionResult(output.call_id, {
          status: "not_authenticated",
          message: "Spotify session expired. Please sign in again.",
        });
        setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
        return;
      }

      const data = await response.json();

      if (data.found) {
        // Play on the Web Playback SDK device or fallback
        const deviceId = await resolveSpotifyDeviceId();
        const playRes = await fetch("/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uris: [data.uri],
            device_id: deviceId,
          }),
        });

        if (playRes.ok) {
          setSpotifyTrack(data);
          onSpotifyPlay();
          sendFunctionResult(output.call_id, {
            status: "playing",
            name: data.name,
            artist: data.artist,
            album: data.album,
          });
        } else {
          sendFunctionResult(output.call_id, {
            status: "error",
            message: "Failed to start playback. Make sure Spotify Premium is active and the player is ready.",
          });
        }
      } else {
        sendFunctionResult(output.call_id, {
          status: "not_found",
          message: `No Spotify tracks found for "${query}"`,
        });
      }

      setTimeout(() => {
        sendClientEvent({ type: "response.create" });
      }, 500);
    } catch (error) {
      console.error("Spotify play track failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: "Failed to search and play on Spotify.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
    }
  }

  async function handleSpotifyPlayPlaylist(output) {
    const { query } = JSON.parse(output.arguments);

    if (!spotifyAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with Spotify first.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
      return;
    }

    try {
      const response = await fetch(
        `/spotify/search?q=${encodeURIComponent(query)}&type=playlist`,
      );
      if (response.status === 401) {
        setSpotifyAuthenticated(false);
        sendFunctionResult(output.call_id, {
          status: "not_authenticated",
          message: "Spotify session expired. Please sign in again.",
        });
        setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
        return;
      }

      const data = await response.json();

      if (data.found) {
        const deviceId = await resolveSpotifyDeviceId();
        const playRes = await fetch("/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context_uri: data.uri,
            device_id: deviceId,
          }),
        });

        if (playRes.ok) {
          setSpotifyTrack({ name: data.name, artist: data.owner, album: "Playlist" });
          onSpotifyPlay();
          sendFunctionResult(output.call_id, {
            status: "playing",
            name: data.name,
            owner: data.owner,
            trackCount: data.trackCount,
            type: "playlist",
          });
        } else {
          sendFunctionResult(output.call_id, {
            status: "error",
            message: "Failed to start playlist playback.",
          });
        }
      } else {
        sendFunctionResult(output.call_id, {
          status: "not_found",
          message: `No Spotify playlist found for "${query}"`,
        });
      }

      setTimeout(() => {
        sendClientEvent({ type: "response.create" });
      }, 500);
    } catch (error) {
      console.error("Spotify play playlist failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: "Failed to search and play playlist on Spotify.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
    }
  }

  async function handleSpotifyPlayMyPlaylist(output) {
    const { playlist_name } = JSON.parse(output.arguments);

    if (!spotifyAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with Spotify first.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
      return;
    }

    try {
      const response = await fetch("/spotify/my/playlists");
      if (response.status === 401) {
        setSpotifyAuthenticated(false);
        sendFunctionResult(output.call_id, {
          status: "not_authenticated",
          message: "Spotify session expired. Please sign in again.",
        });
        setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
        return;
      }

      const data = await response.json();
      const searchLower = playlist_name.toLowerCase();
      const match = data.playlists?.find((p) =>
        p.name.toLowerCase().includes(searchLower),
      );

      if (match) {
        const deviceId = await resolveSpotifyDeviceId();
        const playRes = await fetch("/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context_uri: match.uri,
            device_id: deviceId,
          }),
        });

        if (playRes.ok) {
          setSpotifyTrack({ name: match.name, artist: match.owner, album: "Playlist" });
          onSpotifyPlay();
          sendFunctionResult(output.call_id, {
            status: "playing",
            name: match.name,
            type: "playlist",
            trackCount: match.trackCount,
          });
        } else {
          sendFunctionResult(output.call_id, {
            status: "error",
            message: "Failed to start playlist playback.",
          });
        }
      } else {
        const available = (data.playlists || []).map((p) => p.name).slice(0, 10);
        sendFunctionResult(output.call_id, {
          status: "not_found",
          message: `No playlist matching "${playlist_name}" found.`,
          available_playlists: available,
        });
      }
    } catch (error) {
      console.error("Spotify play my playlist failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: "Failed to fetch your Spotify playlists.",
      });
    }

    setTimeout(() => {
      sendClientEvent({ type: "response.create" });
    }, 500);
  }

  async function handleSpotifyPlaybackControl(output) {
    if (!spotifyAuthenticated) {
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Please sign in with Spotify first.",
      });
      setTimeout(() => sendClientEvent({ type: "response.create" }), 500);
      return;
    }

    const actions = {
      spotify_next_track: async () => {
        await fetch("/spotify/next", { method: "POST" });
        return "Skipped to next track";
      },
      spotify_previous_track: async () => {
        await fetch("/spotify/previous", { method: "POST" });
        return "Went to previous track";
      },
      spotify_pause: async () => {
        // Toggle: check current state
        try {
          const res = await fetch("/spotify/currently-playing");
          const data = await res.json();
          if (data.playing) {
            await fetch("/spotify/pause", { method: "PUT" });
            return "Playback paused";
          } else {
            const deviceId = await resolveSpotifyDeviceId();
            await fetch("/spotify/play", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ device_id: deviceId }),
            });
            return "Playback resumed";
          }
        } catch {
          await fetch("/spotify/pause", { method: "PUT" });
          return "Playback paused";
        }
      },
      spotify_shuffle: async () => {
        await fetch("/spotify/shuffle", { method: "PUT" });
        return "Shuffle toggled";
      },
    };

    try {
      const action = actions[output.name];
      const message = action ? await action() : "Unknown action";
      onSpotifyPlay();

      sendFunctionResult(output.call_id, {
        status: "done",
        action: output.name,
        message,
      });
    } catch (error) {
      console.error("Spotify playback control failed:", error);
      sendFunctionResult(output.call_id, {
        status: "error",
        message: `Failed to execute ${output.name}`,
      });
    }

    setTimeout(() => {
      sendClientEvent({ type: "response.create" });
    }, 500);
  }

  function sendFunctionResult(callId, result) {
    sendClientEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    });
  }

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
      setCurrentVideo(null);
      setSpotifyTrack(null);
    }
  }, [isSessionActive]);

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
    <section className="h-full w-full flex flex-col gap-4">
      <div className="bg-gray-50 rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">Media Player</h2>
          {ytAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 font-medium">YouTube ✓</span>
              <button
                onClick={handleYouTubeLogout}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <a
              href="/auth/google"
              className="text-xs px-2 py-1 rounded border border-blue-500 text-blue-600 hover:bg-blue-50 no-underline"
            >
              Sign in with YouTube
            </a>
          )}
        </div>
        {isSessionActive ? (
          currentVideo ? (
            <MediaPlayer
              ref={mediaPlayerRef}
              videoId={currentVideo.videoId}
              playlistId={currentVideo.playlistId}
              title={currentVideo.title}
              onClose={() => setCurrentVideo(null)}
            />
          ) : (
            <p>Ask to play a song, video, or playlist...</p>
          )
        ) : (
          <p>Start the session to use this tool...</p>
        )}
      </div>
      <div className="bg-gray-50 rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">🎵 Spotify</h2>
          {spotifyAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 font-medium">Spotify ✓</span>
              <button
                onClick={handleSpotifyLogout}
                className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <a
              href="/auth/spotify"
              className="text-xs px-2 py-1 rounded border border-green-500 text-green-600 hover:bg-green-50 no-underline"
            >
              Sign in with Spotify
            </a>
          )}
        </div>
        {isSessionActive ? (
          spotifyAuthenticated ? (
            <SpotifyPlayer
              ref={spotifyPlayerRef}
              onClose={() => setSpotifyTrack(null)}
              onTrackChange={(track) => setSpotifyTrack(track)}
              onPlayStateChange={(isPlaying) => {
                if (isPlaying) onSpotifyPlay?.();
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">Sign in with Spotify to control playback (Premium required for playback control)</p>
          )
        ) : (
          <p>Start the session to use Spotify...</p>
        )}
        {isSessionActive && spotifyAuthenticated && !spotifyTrack && (
          <p className="text-sm mt-1">Ask to play a song or playlist on Spotify...</p>
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
