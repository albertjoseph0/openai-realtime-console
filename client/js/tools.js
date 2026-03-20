// AI tool orchestration — extracted from React ToolPanel.jsx
// Defines tool functions and handles response.done events

import { sendClientEvent, getState, setSpotifyAuthenticated, setYtAuthenticated, onMediaPlay, onSpotifyPlay } from "./session.js";
import { youtubePlayer } from "./media-players.js";

// ── Tool descriptions ──

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

const spotifyPlayPodcastDescription = `
Call this function when a user asks to play a podcast on Spotify, or resume a podcast they were previously listening to.
Extract only the podcast name from their request — do not add extra words like "The" or "podcast" to the query. For example, if the user says "play the Cheeky Pint podcast", set query to "Cheeky Pint".
Set resume to true if the user wants to continue where they left off.
`;

// ── Session update payload ──

const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    instructions:
      "CRITICAL RULE FOR MEDIA TOOLS: When you call ANY media or playback tool " +
      "(play_media, play_playlist, play_my_playlist, play_liked_videos, next_track, previous_track, shuffle_playlist, " +
      "spotify_play_track, spotify_play_playlist, spotify_play_my_playlist, spotify_play_podcast, " +
      "spotify_next_track, spotify_previous_track, spotify_pause, spotify_shuffle), " +
      "you MUST output ONLY the function call with NO accompanying spoken message. " +
      "Do NOT say things like 'let me find that', 'playing now', 'I\\'ll look for that', or anything similar. " +
      "Just silently make the tool call. After the tool result comes back, remain silent if it succeeded. " +
      "Only speak if the tool result indicates an error or failure. " +
      "For non-media tools (like listing playlists or displaying colors), you may respond normally.",
    tools: [
      {
        type: "function",
        name: "display_color_palette",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          additionalProperties: false,
          properties: {
            theme: {
              type: "string",
              description: "Description of the theme for the color scheme.",
            },
            colors: {
              type: "array",
              description: "Array of five hex color codes based on the theme.",
              items: { type: "string", description: "Hex color code" },
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
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              description: "Search query for the song or video. Include artist name if mentioned.",
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
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              description: "Name or description of the playlist to search for.",
            },
          },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "next_track",
        description: "Skip to the next track in the current playlist.",
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "previous_track",
        description: "Go back to the previous track in the current playlist.",
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "shuffle_playlist",
        description: "Shuffle the current playlist so tracks play in random order.",
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "play_my_playlist",
        description: playMyPlaylistDescription,
        parameters: {
          type: "object",
          strict: true,
          additionalProperties: false,
          properties: {
            playlist_name: {
              type: "string",
              description: "Name or partial name of the user's personal playlist to play.",
            },
          },
          required: ["playlist_name"],
        },
      },
      {
        type: "function",
        name: "play_liked_videos",
        description: playLikedVideosDescription,
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "list_my_playlists",
        description: listMyPlaylistsDescription,
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "spotify_play_track",
        description: spotifyPlayTrackDescription,
        parameters: {
          type: "object",
          strict: true,
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              description: "Search query for the song or track. Include artist name if mentioned.",
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
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              description: "Name or description of the Spotify playlist to search for.",
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
          additionalProperties: false,
          properties: {
            playlist_name: {
              type: "string",
              description: "Name or partial name of the user's personal Spotify playlist to play.",
            },
          },
          required: ["playlist_name"],
        },
      },
      {
        type: "function",
        name: "spotify_next_track",
        description: spotifyNextDescription,
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "spotify_previous_track",
        description: spotifyPreviousDescription,
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "spotify_pause",
        description: spotifyPauseDescription,
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "spotify_shuffle",
        description: spotifyShuffleDescription,
        parameters: { type: "object", strict: true, additionalProperties: false, properties: {} },
      },
      {
        type: "function",
        name: "spotify_play_podcast",
        description: spotifyPlayPodcastDescription,
        parameters: {
          type: "object",
          strict: true,
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              description: "Name of the podcast show to search for.",
            },
            resume: {
              type: "boolean",
              description:
                "If true, resumes the most recently started but unfinished episode. If false, plays the latest episode from the beginning.",
            },
          },
          required: ["query", "resume"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

// ── State ──

let functionAdded = false;
let currentVideo = null;

export function resetTools() {
  functionAdded = false;
  currentVideo = null;
}

// ── Event handler (called from session.js on each data channel event) ──

export const initTools = {
  onEvent(event) {
    if (!functionAdded && event.type === "session.created") {
      sendClientEvent(sessionUpdate);
      functionAdded = true;
    }

    // Log user speech transcription
    if (event.type === "conversation.item.input_audio_transcription.completed") {
      console.log(`[User Speech] ${event.transcript}`);
    }

    if (event.type === "response.done" && event.response?.output) {
      // Log any audio transcript from the model's response
      event.response.output.forEach((output) => {
        if (output.type === "message" && output.content) {
          output.content.forEach((c) => {
            if (c.transcript) console.log(`[Agent Response] ${c.transcript}`);
          });
        }
      });

      const handlers = {
        display_color_palette: handleColorPalette,
        play_media: handlePlayMedia,
        play_playlist: handlePlayPlaylist,
        next_track: handlePlaybackControl,
        previous_track: handlePlaybackControl,
        shuffle_playlist: handlePlaybackControl,
        play_my_playlist: handlePlayMyPlaylist,
        play_liked_videos: handlePlayLikedVideos,
        list_my_playlists: handleListMyPlaylists,
        spotify_play_track: handleSpotifyPlayTrack,
        spotify_play_playlist: handleSpotifyPlayPlaylist,
        spotify_play_my_playlist: handleSpotifyPlayMyPlaylist,
        spotify_next_track: handleSpotifyPlaybackControl,
        spotify_previous_track: handleSpotifyPlaybackControl,
        spotify_pause: handleSpotifyPlaybackControl,
        spotify_shuffle: handleSpotifyPlaybackControl,
        spotify_play_podcast: handleSpotifyPlayPodcast,
      };

      const functionCalls = event.response.output.filter(
        (output) => output.type === "function_call" && handlers[output.name],
      );

      if (functionCalls.length > 0) {
        functionCalls.forEach((output) => {
          console.log(`[Tool Call] ${output.name}`, output.arguments);
        });
        // Execute all handlers, then only trigger a response if needed
        Promise.allSettled(
          functionCalls.map((output) => handlers[output.name](output)),
        ).then((results) => {
          const anyNeedsResponse = results.some(
            (r) => r.status === "fulfilled" && r.value?.needsResponse,
          ) || results.some(
            (r) => r.status === "rejected",
          );
          triggerResponse(!anyNeedsResponse);
        });
      }
    }
  },
};

// ── Helpers ──

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

function triggerResponse(silent = false) {
  if (silent) {
    // Text-only response so the model processes the tool output without speaking
    sendClientEvent({
      type: "response.create",
      response: { modalities: ["text"] },
    });
  } else {
    sendClientEvent({ type: "response.create" });
  }
}

function parseArguments(output) {
  try {
    return JSON.parse(output.arguments);
  } catch (error) {
    console.error("Failed to parse function arguments:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Invalid function arguments received.",
    });
    return null;
  }
}

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

// ── Handler functions ──

function handleColorPalette(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  sendFunctionResult(output.call_id, {
    status: "success",
    theme: args.theme,
    colors: args.colors,
  });
  return { needsResponse: true };
}

async function handlePlayMedia(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { query } = args;

  try {
    const response = await fetch(`/youtube/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.found) {
      const playbackRequested = youtubePlayer.load(data.videoId, null, data.title);
      if (playbackRequested) {
        currentVideo = { videoId: data.videoId, title: data.title };
        onMediaPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          title: data.title,
          channel: data.channelTitle,
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Unable to start YouTube playback request.",
        });
        return { needsResponse: true };
      }
    } else {
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `No results found for "${query}"`,
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("YouTube search failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to search YouTube",
    });
    return { needsResponse: true };
  }
}

async function handlePlayPlaylist(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { query } = args;

  try {
    const response = await fetch(`/youtube/playlists/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.found) {
      const playbackRequested = youtubePlayer.load(null, data.playlistId, data.title);
      if (playbackRequested) {
        currentVideo = { playlistId: data.playlistId, title: data.title };
        onMediaPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          title: data.title,
          channel: data.channelTitle,
          type: "playlist",
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Unable to start YouTube playlist request.",
        });
        return { needsResponse: true };
      }
    } else {
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `No playlist found for "${query}"`,
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("YouTube playlist search failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to search YouTube playlists",
    });
    return { needsResponse: true };
  }
}

function handlePlaybackControl(output) {
  const actions = {
    next_track: () => youtubePlayer.next(),
    previous_track: () => youtubePlayer.previous(),
    shuffle_playlist: () => youtubePlayer.shuffle(true),
  };

  const action = actions[output.name];
  const hasMedia = !!currentVideo;

  if (hasMedia && action) {
    action();
    onMediaPlay();
  }

  sendFunctionResult(output.call_id, {
    status: hasMedia ? "done" : "no_media",
    action: output.name,
    message: hasMedia
      ? `${output.name} executed successfully`
      : "No media is currently playing",
  });
  return { needsResponse: !hasMedia };
}

async function handlePlayMyPlaylist(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { playlist_name } = args;
  const { ytAuthenticated } = getState();

  if (!ytAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with YouTube first using the button in the Media Player panel.",
    });
    return { needsResponse: true };
  }

  try {
    const response = await fetch("/youtube/my/playlists");
    if (response.status === 401) {
      setYtAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "YouTube session expired. Please sign in again.",
      });
      return { needsResponse: true };
    }

    const data = await response.json();
    const searchLower = playlist_name.toLowerCase();
    const match = data.playlists?.find((p) =>
      p.title.toLowerCase().includes(searchLower),
    );

    if (match) {
      const playbackRequested = youtubePlayer.load(null, match.id, match.title);
      if (playbackRequested) {
        currentVideo = { playlistId: match.id, title: match.title };
        onMediaPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          title: match.title,
          type: "playlist",
          itemCount: match.itemCount,
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Unable to start your playlist playback request.",
        });
        return { needsResponse: true };
      }
    } else {
      const available = (data.playlists || []).map((p) => p.title).slice(0, 10);
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `No playlist matching "${playlist_name}" found.`,
        available_playlists: available,
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("Play my playlist failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to fetch your playlists.",
    });
    return { needsResponse: true };
  }
}

async function handlePlayLikedVideos(output) {
  const { ytAuthenticated } = getState();

  if (!ytAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with YouTube first using the button in the Media Player panel.",
    });
    return { needsResponse: true };
  }

  try {
    const response = await fetch("/youtube/my/liked");
    if (response.status === 401) {
      setYtAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "YouTube session expired. Please sign in again.",
      });
      return { needsResponse: true };
    }

    const data = await response.json();
    if (data.videos && data.videos.length > 0) {
      const playbackRequested = youtubePlayer.load(null, "LL", "Liked Videos");
      if (playbackRequested) {
        currentVideo = { playlistId: "LL", title: "Liked Videos" };
        onMediaPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          title: "Liked Videos",
          type: "playlist",
          videoCount: data.videos.length,
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Unable to start liked videos playback request.",
        });
        return { needsResponse: true };
      }
    } else {
      sendFunctionResult(output.call_id, {
        status: "empty",
        message: "No liked videos found.",
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("Play liked videos failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to fetch liked videos.",
    });
    return { needsResponse: true };
  }
}

async function handleListMyPlaylists(output) {
  const { ytAuthenticated } = getState();

  if (!ytAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with YouTube first using the button in the Media Player panel.",
    });
    return { needsResponse: true };
  }

  try {
    const response = await fetch("/youtube/my/playlists");
    if (response.status === 401) {
      setYtAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "YouTube session expired. Please sign in again.",
      });
      return { needsResponse: true };
    }

    const data = await response.json();
    sendFunctionResult(output.call_id, {
      status: "success",
      playlists: (data.playlists || []).map((p) => ({
        title: p.title,
        itemCount: p.itemCount,
      })),
    });
    return { needsResponse: true };
  } catch (error) {
    console.error("List playlists failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to fetch your playlists.",
    });
    return { needsResponse: true };
  }
}

// ── Spotify handlers ──

async function handleSpotifyPlayTrack(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { query } = args;
  const { spotifyAuthenticated } = getState();

  if (!spotifyAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with Spotify first using the button in the Spotify panel.",
    });
    return { needsResponse: true };
  }

  try {
    const response = await fetch(`/spotify/search?q=${encodeURIComponent(query)}&type=track`);
    if (response.status === 401) {
      setSpotifyAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Spotify session expired. Please sign in again.",
      });
      return { needsResponse: true };
    }

    const data = await response.json();

    if (data.found) {
      const deviceId = await resolveSpotifyDeviceId();
      const playRes = await fetch("/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [data.uri], device_id: deviceId }),
      });

      if (playRes.ok) {
        onSpotifyPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          name: data.name,
          artist: data.artist,
          album: data.album,
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Failed to start playback. Make sure Spotify Premium is active and the player is ready.",
        });
        return { needsResponse: true };
      }
    } else {
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `No Spotify tracks found for "${query}"`,
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("Spotify play track failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to search and play on Spotify.",
    });
    return { needsResponse: true };
  }
}

async function handleSpotifyPlayPlaylist(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { query } = args;
  const { spotifyAuthenticated } = getState();

  if (!spotifyAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with Spotify first.",
    });
    return { needsResponse: true };
  }

  try {
    const response = await fetch(`/spotify/search?q=${encodeURIComponent(query)}&type=playlist`);
    if (response.status === 401) {
      setSpotifyAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Spotify session expired. Please sign in again.",
      });
      return { needsResponse: true };
    }

    const data = await response.json();

    if (data.found) {
      const deviceId = await resolveSpotifyDeviceId();
      const playRes = await fetch("/spotify/play", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_uri: data.uri, device_id: deviceId }),
      });

      if (playRes.ok) {
        onSpotifyPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          name: data.name,
          owner: data.owner,
          trackCount: data.trackCount,
          type: "playlist",
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Failed to start playlist playback.",
        });
        return { needsResponse: true };
      }
    } else {
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `No Spotify playlist found for "${query}"`,
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("Spotify play playlist failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to search and play playlist on Spotify.",
    });
    return { needsResponse: true };
  }
}

async function handleSpotifyPlayMyPlaylist(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { playlist_name } = args;
  const { spotifyAuthenticated } = getState();

  if (!spotifyAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with Spotify first.",
    });
    return { needsResponse: true };
  }

  try {
    const response = await fetch("/spotify/my/playlists");
    if (response.status === 401) {
      setSpotifyAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Spotify session expired. Please sign in again.",
      });
      return { needsResponse: true };
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
        body: JSON.stringify({ context_uri: match.uri, device_id: deviceId }),
      });

      if (playRes.ok) {
        onSpotifyPlay();
        sendFunctionResult(output.call_id, {
          status: "playing",
          name: match.name,
          type: "playlist",
          trackCount: match.trackCount,
        });
        return { needsResponse: false };
      } else {
        sendFunctionResult(output.call_id, {
          status: "error",
          message: "Failed to start playlist playback.",
        });
        return { needsResponse: true };
      }
    } else {
      const available = (data.playlists || []).map((p) => p.name).slice(0, 10);
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `No playlist matching "${playlist_name}" found.`,
        available_playlists: available,
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("Spotify play my playlist failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to fetch your Spotify playlists.",
    });
    return { needsResponse: true };
  }
}

async function handleSpotifyPlaybackControl(output) {
  const { spotifyAuthenticated } = getState();

  if (!spotifyAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with Spotify first.",
    });
    return { needsResponse: true };
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
    return { needsResponse: false };
  } catch (error) {
    console.error("Spotify playback control failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: `Failed to execute ${output.name}`,
    });
    return { needsResponse: true };
  }
}

async function handleSpotifyPlayPodcast(output) {
  const args = parseArguments(output);
  if (!args) return { needsResponse: true };
  const { query, resume } = args;
  const { spotifyAuthenticated } = getState();

  if (!spotifyAuthenticated) {
    sendFunctionResult(output.call_id, {
      status: "not_authenticated",
      message: "Please sign in with Spotify first using the button in the Spotify panel.",
    });
    return { needsResponse: true };
  }

  try {
    // Search for the podcast show
    console.log(`[Podcast] Searching for show: "${query}" (resume=${resume})`);
    const searchRes = await fetch(`/spotify/search?q=${encodeURIComponent(query)}&type=show`);
    if (searchRes.status === 401) {
      setSpotifyAuthenticated(false);
      sendFunctionResult(output.call_id, {
        status: "not_authenticated",
        message: "Spotify session expired. Please sign in again.",
      });
      return { needsResponse: true };
    }
    const searchData = await searchRes.json();
    console.log(`[Podcast] Search result:`, JSON.stringify(searchData));
    if (!searchData.found) {
      sendFunctionResult(output.call_id, {
        status: "not_found",
        message: `Could not find a podcast called "${query}" on Spotify.`,
      });
      return { needsResponse: true };
    }

    const showId = searchData.id;
    const showName = searchData.name;
    console.log(`[Podcast] Found show: "${showName}" (id=${showId})`);

    // Fetch episodes (more if resuming to find an in-progress one)
    const episodeLimit = resume ? 10 : 1;
    const epRes = await fetch(`/spotify/shows/${showId}/episodes?limit=${episodeLimit}`);
    const epData = await epRes.json();
    const episodes = epData.episodes || [];
    console.log(`[Podcast] Got ${episodes.length} episodes:`, episodes.map(e => e.name));

    if (episodes.length === 0) {
      sendFunctionResult(output.call_id, {
        status: "no_episodes",
        message: `The podcast "${showName}" has no available episodes.`,
      });
      return { needsResponse: true };
    }

    let targetEpisode = null;
    let resumed = false;

    if (resume) {
      // Find the most recent episode that has been started but not finished
      targetEpisode = episodes.find(
        (ep) =>
          ep.resumePoint &&
          !ep.resumePoint.fully_played &&
          ep.resumePoint.resume_position_ms > 0,
      );
      if (targetEpisode) {
        resumed = true;
      } else {
        // No in-progress episode found — fall back to the latest
        targetEpisode = episodes[0];
      }
    } else {
      targetEpisode = episodes[0];
    }

    // Play the episode — Spotify natively resumes podcast position
    const deviceId = await resolveSpotifyDeviceId();
    const playBody = {
      uris: [targetEpisode.uri],
      device_id: deviceId,
    };

    const playRes = await fetch("/spotify/play", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playBody),
    });

    if (playRes.ok) {
      onSpotifyPlay();
      sendFunctionResult(output.call_id, {
        status: "playing",
        show: showName,
        episode: targetEpisode.name,
        releaseDate: targetEpisode.releaseDate,
        resumed,
      });
      return { needsResponse: false };
    } else {
      const errData = await playRes.json().catch(() => ({}));
      sendFunctionResult(output.call_id, {
        status: "error",
        message: errData.error || "Failed to play podcast episode.",
      });
      return { needsResponse: true };
    }
  } catch (error) {
    console.error("Spotify play podcast failed:", error);
    sendFunctionResult(output.call_id, {
      status: "error",
      message: "Failed to play podcast. Please try again.",
    });
    return { needsResponse: true };
  }
}
