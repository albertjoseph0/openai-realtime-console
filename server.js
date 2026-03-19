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

// Configure Vite middleware for React client
const vite = await createViteServer({
  server: { middlewareMode: true },
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

// Render the React client
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8"),
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});
