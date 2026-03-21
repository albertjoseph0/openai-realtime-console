import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import "dotenv/config";

const app = express();
app.use(express.text());
const port = process.env.PORT || 3000;
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
const youtubeApiKey = process.env.YOUTUBE_API_KEY;

// Google OAuth2 config
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri =
  process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/google/callback`;
const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly"];
const TOKEN_PATH = "youtube-tokens.json";

let oauth2Client = null;
let isYouTubeAuthenticated = false;

function createOAuth2Client() {
  return new OAuth2Client({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUri: googleRedirectUri,
  });
}

function loadStoredTokens() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials(tokens);
      oauth2Client.on("tokens", persistTokens);
      isYouTubeAuthenticated = true;
      console.log("YouTube OAuth tokens loaded from file");
    }
  } catch (err) {
    console.error("Failed to load stored YouTube tokens:", err.message);
  }
}

function persistTokens(tokens) {
  try {
    const existing = fs.existsSync(TOKEN_PATH)
      ? JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"))
      : {};
    const merged = { ...existing, ...tokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  } catch (err) {
    console.error("Failed to persist YouTube tokens:", err.message);
  }
}

// Load tokens on startup
loadStoredTokens();

// Configure Vite middleware for client assets
const vite = await createViteServer({
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
app.use(vite.middlewares);

const sessionConfig = JSON.stringify({
  session: {
    type: "realtime",
    model: azureDeployment,
    audio: {
      output: {
        voice: "marin",
      },
    },
  },
});

// API route for ephemeral token generation
app.get("/token", async (req, res) => {
  try {
    const response = await fetch(
      `${azureEndpoint}/openai/v1/realtime/client_secrets`,
      {
        method: "POST",
        headers: {
          "api-key": azureApiKey,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      },
    );

    const data = await response.json();
    // Include the endpoint so the client can use it for the WebRTC SDP exchange
    res.json({ ...data, endpoint: azureEndpoint });
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// YouTube search endpoint (proxies YouTube Data API to keep key private)
app.get("/youtube/search", async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("key", youtubeApiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("YouTube API error:", data);
      return res.status(response.status).json({ error: "YouTube API error" });
    }

    const item = data.items?.[0];
    if (!item) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    res.status(500).json({ error: "Failed to search YouTube" });
  }
});

// YouTube playlist search endpoint
app.get("/youtube/playlists/search", async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "playlist");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "1");
    url.searchParams.set("key", youtubeApiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      console.error("YouTube playlist search API error:", data);
      return res.status(response.status).json({ error: "YouTube API error" });
    }

    const item = data.items?.[0];
    if (!item) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      playlistId: item.id.playlistId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
    });
  } catch (error) {
    console.error("YouTube playlist search error:", error);
    res.status(500).json({ error: "Failed to search YouTube playlists" });
  }
});

// ── Google OAuth2 routes ──

app.get("/auth/google", (req, res) => {
  if (!googleClientId || !googleClientSecret) {
    return res.status(500).json({ error: "Google OAuth credentials not configured" });
  }

  const client = createOAuth2Client();
  const authorizeUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: YOUTUBE_SCOPES,
    prompt: "consent",
  });

  res.redirect(authorizeUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    client.on("tokens", persistTokens);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    oauth2Client = client;
    isYouTubeAuthenticated = true;

    console.log("YouTube OAuth login successful");
    res.redirect("/");
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("Authentication failed. Please try again.");
  }
});

app.get("/auth/google/status", (req, res) => {
  res.json({ authenticated: isYouTubeAuthenticated });
});

// Quick diagnostic endpoint to test YouTube API access
app.get("/auth/google/test", async (req, res) => {
  if (!isYouTubeAuthenticated || !oauth2Client) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelRes = await youtube.channels.list({ part: "id,snippet", mine: true });
    const channel = channelRes.data.items?.[0];

    if (!channel) {
      return res.json({
        tokenValid: true,
        hasChannel: false,
        message: "Token works but no YouTube channel found. Create one at youtube.com.",
      });
    }

    const playlistRes = await youtube.playlists.list({
      part: "snippet",
      channelId: channel.id,
      maxResults: 5,
    });

    res.json({
      tokenValid: true,
      hasChannel: true,
      channelTitle: channel.snippet.title,
      playlistCount: playlistRes.data.pageInfo?.totalResults || 0,
      samplePlaylists: (playlistRes.data.items || []).map((p) => p.snippet.title),
    });
  } catch (error) {
    console.error("Auth test error:", error.message);
    res.status(500).json({ tokenValid: false, error: error.message });
  }
});

app.post("/auth/google/logout", (req, res) => {
  try {
    if (oauth2Client && oauth2Client.credentials?.access_token) {
      oauth2Client.revokeToken(oauth2Client.credentials.access_token).catch(() => {});
    }
  } catch {}

  oauth2Client = null;
  isYouTubeAuthenticated = false;
  try {
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
  } catch {}

  res.json({ success: true });
});

// ── Authenticated YouTube endpoints ──

// Helper: verify channel exists before making mine=true calls
async function getYouTubeChannel(youtube) {
  const res = await youtube.channels.list({ part: "id,snippet", mine: true });
  return res.data.items?.[0] || null;
}

app.get("/youtube/my/playlists", async (req, res) => {
  if (!isYouTubeAuthenticated || !oauth2Client) {
    return res.status(401).json({ error: "Not authenticated with YouTube" });
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Check channel exists first to give a clear error
    const channel = await getYouTubeChannel(youtube);
    if (!channel) {
      return res.status(404).json({
        error: "no_channel",
        message: "Your Google account doesn't have a YouTube channel. Please visit youtube.com and create a channel first.",
      });
    }

    const response = await youtube.playlists.list({
      part: "snippet,contentDetails,status",
      channelId: channel.id,
      maxResults: 50,
    });

    const playlists = (response.data.items || [])
      .filter((item) => item.status?.privacyStatus === "public")
      .map((item) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.default?.url,
      itemCount: item.contentDetails?.itemCount,
    }));

    res.json({ playlists });
  } catch (error) {
    console.error("Failed to fetch user playlists:", error.message);
    if (error.code === 401 || error.status === 401) {
      isYouTubeAuthenticated = false;
      return res.status(401).json({ error: "Token expired. Please re-authenticate." });
    }
    if (error.message?.includes("Channel not found")) {
      return res.status(404).json({
        error: "no_channel",
        message: "YouTube channel not found. Please visit youtube.com and create a channel.",
      });
    }
    res.status(500).json({ error: "Failed to fetch playlists", details: error.message });
  }
});

app.get("/youtube/my/liked", async (req, res) => {
  if (!isYouTubeAuthenticated || !oauth2Client) {
    return res.status(401).json({ error: "Not authenticated with YouTube" });
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await youtube.playlistItems.list({
      part: "snippet,contentDetails",
      playlistId: "LL",
      maxResults: 50,
    });

    const videos = (response.data.items || []).map((item) => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url,
    }));

    res.json({ videos });
  } catch (error) {
    console.error("Failed to fetch liked videos:", error.message);
    if (error.code === 401 || error.status === 401) {
      isYouTubeAuthenticated = false;
      return res.status(401).json({ error: "Token expired. Please re-authenticate." });
    }
    if (error.message?.includes("Channel not found")) {
      return res.status(404).json({
        error: "no_channel",
        message: "YouTube channel not found. Please visit youtube.com and create a channel.",
      });
    }
    res.status(500).json({ error: "Failed to fetch liked videos", details: error.message });
  }
});

app.get("/youtube/my/playlist/:id/items", async (req, res) => {
  if (!isYouTubeAuthenticated || !oauth2Client) {
    return res.status(401).json({ error: "Not authenticated with YouTube" });
  }

  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const response = await youtube.playlistItems.list({
      part: "snippet,contentDetails",
      playlistId: req.params.id,
      maxResults: 50,
    });

    const videos = (response.data.items || []).map((item) => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url,
    }));

    res.json({ videos });
  } catch (error) {
    console.error("Failed to fetch playlist items:", error.message);
    if (error.code === 401 || error.status === 401) {
      isYouTubeAuthenticated = false;
      return res.status(401).json({ error: "Token expired. Please re-authenticate." });
    }
    res.status(500).json({ error: "Failed to fetch playlist items", details: error.message });
  }
});

// ── Spotify OAuth2 & API routes ──

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const spotifyRedirectUri =
  process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${port}/auth/spotify/callback`;
const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-position",
].join(" ");
const SPOTIFY_TOKEN_PATH = "spotify-tokens.json";

let spotifyTokens = null;
let isSpotifyAuthenticated = false;

function loadSpotifyTokens() {
  try {
    if (fs.existsSync(SPOTIFY_TOKEN_PATH)) {
      spotifyTokens = JSON.parse(fs.readFileSync(SPOTIFY_TOKEN_PATH, "utf-8"));
      isSpotifyAuthenticated = true;
      console.log("Spotify OAuth tokens loaded from file");
    }
  } catch (err) {
    console.error("Failed to load stored Spotify tokens:", err.message);
  }
}

function persistSpotifyTokens(tokens) {
  try {
    const existing = spotifyTokens || {};
    spotifyTokens = { ...existing, ...tokens, updated_at: Date.now() };
    fs.writeFileSync(SPOTIFY_TOKEN_PATH, JSON.stringify(spotifyTokens, null, 2));
  } catch (err) {
    console.error("Failed to persist Spotify tokens:", err.message);
  }
}

async function getSpotifyAccessToken() {
  if (!spotifyTokens) return null;

  // Check if token is expired (with 60s buffer)
  const expiresAt = (spotifyTokens.updated_at || 0) + (spotifyTokens.expires_in || 3600) * 1000;
  if (Date.now() > expiresAt - 60000 && spotifyTokens.refresh_token) {
    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: spotifyTokens.refresh_token,
        }),
      });
      const data = await response.json();
      if (data.access_token) {
        persistSpotifyTokens(data);
        console.log("Spotify token refreshed");
      }
    } catch (err) {
      console.error("Failed to refresh Spotify token:", err.message);
    }
  }

  return spotifyTokens?.access_token || null;
}

async function spotifyApiFetch(path, options = {}) {
  const token = await getSpotifyAccessToken();
  if (!token) throw new Error("Not authenticated with Spotify");

  const url = path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 204) return {};

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.error?.message || `Spotify API error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

loadSpotifyTokens();

app.get("/auth/spotify", (req, res) => {
  if (!spotifyClientId || !spotifyClientSecret) {
    return res.status(500).json({ error: "Spotify OAuth credentials not configured" });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: spotifyClientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: spotifyRedirectUri,
    show_dialog: "true",
  });

  const authorizeUrl = `https://accounts.spotify.com/authorize?${params}`;
  console.log("Spotify auth redirect to:", authorizeUrl);
  console.log("Redirect URI configured as:", spotifyRedirectUri);
  res.redirect(authorizeUrl);
});

app.get("/auth/spotify/callback", async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    console.error("Spotify auth denied/error:", error, "description:", req.query.error_description);
    return res.redirect("/?spotify_auth=error&reason=" + encodeURIComponent(error));
  }
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: spotifyRedirectUri,
      }),
    });

    const tokens = await response.json();
    if (tokens.error) {
      console.error("Spotify token exchange error:", tokens.error, tokens.error_description);
      return res.status(500).send(`Authentication failed: ${tokens.error_description || tokens.error}. Please try again.`);
    }

    persistSpotifyTokens(tokens);
    isSpotifyAuthenticated = true;
    console.log("Spotify OAuth login successful");
    res.redirect("/");
  } catch (err) {
    console.error("Spotify OAuth callback error:", err);
    res.status(500).send("Authentication failed. Please try again.");
  }
});

app.get("/auth/spotify/status", (req, res) => {
  res.json({ authenticated: isSpotifyAuthenticated });
});

app.post("/auth/spotify/logout", (req, res) => {
  spotifyTokens = null;
  isSpotifyAuthenticated = false;
  try {
    if (fs.existsSync(SPOTIFY_TOKEN_PATH)) fs.unlinkSync(SPOTIFY_TOKEN_PATH);
  } catch {}
  res.json({ success: true });
});

// Spotify search (tracks or playlists)
app.get("/spotify/search", async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }

  const query = req.query.q;
  const type = req.query.type || "track";
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    if (type === "auto") {
      return await handleAutoSearch(query, res);
    }

    const searchType = type === "podcast" ? "show" : type;
    const limit = searchType === "show" ? 5 : 10;
    const data = await spotifyApiFetch(
      `/search?q=${encodeURIComponent(query)}&type=${searchType}&limit=${limit}`,
    );

    if (type === "track") {
      const track = data.tracks?.items?.[0];
      if (!track) return res.json({ found: false });
      res.json({
        found: true,
        type: "track",
        uri: track.uri,
        name: track.name,
        artist: track.artists?.map((a) => a.name).join(", "),
        album: track.album?.name,
        albumArt: track.album?.images?.[0]?.url,
        durationMs: track.duration_ms,
      });
    } else if (type === "artist") {
      const artist = data.artists?.items?.[0];
      if (!artist) return res.json({ found: false });
      res.json({
        found: true,
        type: "artist",
        uri: artist.uri,
        name: artist.name,
        genres: artist.genres?.slice(0, 3),
        popularity: artist.popularity,
        image: artist.images?.[0]?.url,
      });
    } else if (type === "album") {
      const album = data.albums?.items?.[0];
      if (!album) return res.json({ found: false });
      res.json({
        found: true,
        type: "album",
        uri: album.uri,
        name: album.name,
        artist: album.artists?.map((a) => a.name).join(", "),
        totalTracks: album.total_tracks,
        releaseDate: album.release_date,
        image: album.images?.[0]?.url,
      });
    } else if (type === "playlist") {
      const playlist = data.playlists?.items?.[0];
      if (!playlist) return res.json({ found: false });
      res.json({
        found: true,
        type: "playlist",
        uri: playlist.uri,
        name: playlist.name,
        owner: playlist.owner?.display_name,
        trackCount: playlist.tracks?.total,
        image: playlist.images?.[0]?.url,
      });
    } else if (type === "show" || type === "podcast") {
      const show = data.shows?.items?.[0];
      if (!show) return res.json({ found: false });
      res.json({
        found: true,
        type: "show",
        id: show.id,
        uri: show.uri,
        name: show.name,
        publisher: show.publisher,
        totalEpisodes: show.total_episodes,
        image: show.images?.[0]?.url,
      });
    } else if (type === "episode") {
      const episode = data.episodes?.items?.[0];
      if (!episode) return res.json({ found: false });
      res.json({
        found: true,
        type: "episode",
        id: episode.id,
        uri: episode.uri,
        name: episode.name,
        show: episode.show?.name,
        showId: episode.show?.id,
        description: episode.description,
        releaseDate: episode.release_date,
        durationMs: episode.duration_ms,
        resumePoint: episode.resume_point,
        image: episode.images?.[0]?.url,
      });
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error("Spotify search error:", error.message);
    if (error.status === 401) {
      isSpotifyAuthenticated = false;
      return res.status(401).json({ error: "Token expired. Please re-authenticate." });
    }
    res.status(500).json({ error: "Failed to search Spotify" });
  }
});

// Auto-detect best content type for a query
async function handleAutoSearch(query, res) {
  const data = await spotifyApiFetch(
    `/search?q=${encodeURIComponent(query)}&type=track,artist,album,playlist&limit=3`,
  );

  const queryLower = query.toLowerCase().trim();

  const candidates = [];

  // Collect top result from each type
  const artist = data.artists?.items?.[0];
  if (artist) {
    const nameMatch = artist.name.toLowerCase() === queryLower;
    candidates.push({
      type: "artist",
      score: (artist.popularity || 0) + (nameMatch ? 200 : 0) + 10,
      result: {
        found: true, type: "artist", uri: artist.uri, name: artist.name,
        genres: artist.genres?.slice(0, 3), popularity: artist.popularity,
        image: artist.images?.[0]?.url,
      },
    });
  }

  const playlist = data.playlists?.items?.[0];
  if (playlist) {
    const nameMatch = playlist.name.toLowerCase() === queryLower;
    candidates.push({
      type: "playlist",
      score: 50 + (nameMatch ? 100 : 0),
      result: {
        found: true, type: "playlist", uri: playlist.uri, name: playlist.name,
        owner: playlist.owner?.display_name, trackCount: playlist.tracks?.total,
        image: playlist.images?.[0]?.url,
      },
    });
  }

  const album = data.albums?.items?.[0];
  if (album) {
    const nameMatch = album.name.toLowerCase() === queryLower;
    candidates.push({
      type: "album",
      score: 40 + (nameMatch ? 120 : 0),
      result: {
        found: true, type: "album", uri: album.uri, name: album.name,
        artist: album.artists?.map((a) => a.name).join(", "),
        totalTracks: album.total_tracks, releaseDate: album.release_date,
        image: album.images?.[0]?.url,
      },
    });
  }

  const track = data.tracks?.items?.[0];
  if (track) {
    const nameMatch = track.name.toLowerCase() === queryLower;
    candidates.push({
      type: "track",
      score: (track.popularity || 0) + (nameMatch ? 100 : 0),
      result: {
        found: true, type: "track", uri: track.uri, name: track.name,
        artist: track.artists?.map((a) => a.name).join(", "),
        album: track.album?.name, albumArt: track.album?.images?.[0]?.url,
        durationMs: track.duration_ms,
      },
    });
  }

  if (candidates.length === 0) {
    return res.json({ found: false });
  }

  candidates.sort((a, b) => b.score - a.score);
  console.log(`[Spotify Auto] Query: "${query}" → picked ${candidates[0].type} "${candidates[0].result.name}" (score: ${candidates[0].score})`);
  res.json(candidates[0].result);
}

// List user's playlists
app.get("/spotify/my/playlists", async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }

  try {
    const data = await spotifyApiFetch("/me/playlists?limit=50");
    const playlists = (data.items || []).map((p) => ({
      id: p.id,
      uri: p.uri,
      name: p.name,
      owner: p.owner?.display_name,
      trackCount: p.tracks?.total,
      image: p.images?.[0]?.url,
    }));
    res.json({ playlists });
  } catch (error) {
    console.error("Failed to fetch Spotify playlists:", error.message);
    if (error.status === 401) {
      isSpotifyAuthenticated = false;
      return res.status(401).json({ error: "Token expired. Please re-authenticate." });
    }
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

// Start/resume playback
app.put("/spotify/play", express.json(), async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }

  try {
    const body = {};
    if (req.body.context_uri) body.context_uri = req.body.context_uri;
    if (req.body.uris) body.uris = req.body.uris;
    if (req.body.offset) body.offset = req.body.offset;

    let deviceId = req.body.device_id;

    // If no device specified, find one and transfer playback to it
    if (!deviceId) {
      const devData = await spotifyApiFetch("/me/player/devices");
      const devices = devData.devices || [];
      const active = devices.find((d) => d.is_active);
      deviceId = active?.id || devices[0]?.id;
      // If we found an inactive device, transfer playback to it first
      if (deviceId && !active) {
        await spotifyApiFetch("/me/player", {
          method: "PUT",
          body: JSON.stringify({ device_ids: [deviceId], play: false }),
        });
      }
    }

    const deviceParam = deviceId ? `?device_id=${deviceId}` : "";
    await spotifyApiFetch(`/me/player/play${deviceParam}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    res.json({ status: "playing" });
  } catch (error) {
    console.error("Spotify play error:", error.message);
    if (error.status === 401) {
      isSpotifyAuthenticated = false;
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.message?.includes("No active device")) {
      return res.status(404).json({ error: "No active Spotify device found. Please open Spotify on your device." });
    }
    res.status(500).json({ error: error.message });
  }
});

// Pause playback
app.put("/spotify/pause", express.json(), async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }
  try {
    const deviceParam = req.body?.device_id ? `?device_id=${req.body.device_id}` : "";
    await spotifyApiFetch(`/me/player/pause${deviceParam}`, { method: "PUT" });
    res.json({ status: "paused" });
  } catch (error) {
    if (error.message?.includes("Restriction violated") || error.message?.includes("No active device")) {
      return res.json({ status: "already_paused" });
    }
    console.error("Spotify pause error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Skip to next track
app.post("/spotify/next", express.json(), async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }
  try {
    const deviceParam = req.body?.device_id ? `?device_id=${req.body.device_id}` : "";
    await spotifyApiFetch(`/me/player/next${deviceParam}`, { method: "POST" });
    res.json({ status: "skipped" });
  } catch (error) {
    if (error.message?.includes("No active device")) {
      return res.status(404).json({ error: "No active Spotify device found. Please open Spotify on your device." });
    }
    console.error("Spotify next error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Previous track
app.post("/spotify/previous", express.json(), async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }
  try {
    const deviceParam = req.body?.device_id ? `?device_id=${req.body.device_id}` : "";
    await spotifyApiFetch(`/me/player/previous${deviceParam}`, { method: "POST" });
    res.json({ status: "previous" });
  } catch (error) {
    if (error.message?.includes("No active device")) {
      return res.status(404).json({ error: "No active Spotify device found. Please open Spotify on your device." });
    }
    console.error("Spotify previous error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Toggle shuffle
app.put("/spotify/shuffle", express.json(), async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }
  try {
    const state = await spotifyApiFetch("/me/player");
    const currentShuffle = state.shuffle_state || false;
    const deviceParam = req.body?.device_id ? `&device_id=${req.body.device_id}` : "";
    await spotifyApiFetch(`/me/player/shuffle?state=${!currentShuffle}${deviceParam}`, { method: "PUT" });
    res.json({ status: "shuffle_toggled", shuffle: !currentShuffle });
  } catch (error) {
    if (error.message?.includes("No active device")) {
      return res.status(404).json({ error: "No active Spotify device found. Please open Spotify on your device." });
    }
    console.error("Spotify shuffle error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get episodes for a podcast show
app.get("/spotify/shows/:id/episodes", async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }

  const { id } = req.params;
  const limit = req.query.limit || 10;

  try {
    const data = await spotifyApiFetch(`/shows/${id}/episodes?limit=${limit}`);
    const episodes = (data.items || []).map((ep) => ({
      id: ep.id,
      uri: ep.uri,
      name: ep.name,
      description: ep.description?.substring(0, 200),
      releaseDate: ep.release_date,
      durationMs: ep.duration_ms,
      resumePoint: ep.resume_point || null,
    }));
    res.json({ episodes });
  } catch (error) {
    console.error("Spotify show episodes error:", error.message);
    if (error.status === 401) {
      isSpotifyAuthenticated = false;
      return res.status(401).json({ error: "Token expired. Please re-authenticate." });
    }
    res.status(500).json({ error: "Failed to fetch show episodes" });
  }
});

// Get available devices
app.get("/spotify/devices", async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }
  try {
    const data = await spotifyApiFetch("/me/player/devices");
    res.json({ devices: data.devices || [] });
  } catch (error) {
    console.error("Spotify devices error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get currently playing
app.get("/spotify/currently-playing", async (req, res) => {
  if (!isSpotifyAuthenticated) {
    return res.status(401).json({ error: "Not authenticated with Spotify" });
  }
  try {
    const data = await spotifyApiFetch("/me/player/currently-playing");
    if (!data || !data.item) {
      return res.json({ playing: false });
    }
    res.json({
      playing: data.is_playing,
      name: data.item.name,
      artist: data.item.artists?.map((a) => a.name).join(", "),
      album: data.item.album?.name,
      albumArt: data.item.album?.images?.[0]?.url,
      uri: data.item.uri,
      progressMs: data.progress_ms,
      durationMs: data.item.duration_ms,
    });
  } catch (error) {
    console.error("Spotify currently-playing error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Healthcheck endpoint (required by once)
app.get("/up", (req, res) => res.sendStatus(200));

// Serve the client HTML for all unmatched routes
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    res.status(200).set({ "Content-Type": "text/html" }).end(template);
  } catch (e) {
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
