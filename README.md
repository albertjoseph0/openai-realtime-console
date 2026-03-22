# Commute Assistant Albert

An AI-powered voice commute assistant built on Azure OpenAI's Realtime API with WebRTC. Start a session, talk to Albert, and control your music and media hands-free.

## What it does

- **Voice conversations** — Real-time audio chat with Albert via Azure OpenAI Realtime API (WebRTC)
- **Spotify integration** — Play music, podcasts, and playlists by voice ("Play the Huberman Lab podcast", "Play my Discover Weekly")
- **YouTube integration** — Search and play videos or personal playlists inline ("Play Bohemian Rhapsody by Queen", "Play my liked videos")
- **Instant interruption** — Tap the Talk button while Albert is speaking to immediately stop and take over
- **Tool call silence** — Albert stays quiet during media actions so playback starts without chatter

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- An Azure subscription with a [Microsoft Foundry resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource)
- A deployed GPT realtime model (e.g. `gpt-4o-realtime-preview`) in a supported region (East US 2 or Sweden Central)

## Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI resource endpoint (e.g. `https://my-resource.openai.azure.com`) |
| `AZURE_OPENAI_API_KEY` | Your Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Your realtime model deployment name |
| `YOUTUBE_API_KEY` | [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key |

### Spotify (optional)

To enable Spotify playback, add your [Spotify Developer](https://developer.spotify.com/dashboard) credentials:

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app Client Secret |
| `SPOTIFY_REDIRECT_URI` | `http://localhost:3000/auth/spotify/callback` |

### YouTube OAuth (optional — personal playlists & liked videos)

To access personal YouTube playlists:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **YouTube Data API v3**
3. Create **OAuth client ID** credentials (Web application)
4. Add `http://localhost:3000/auth/google/callback` as an authorized redirect URI

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/auth/google/callback` |

## Running

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), tap **Start Session**, then tap **Talk** to begin.

## Usage

1. **Start Session** — Connects to Azure OpenAI Realtime via WebRTC
2. **Talk** — Hold to speak; Albert listens and responds
3. **Interrupt** — Tap Talk while Albert is speaking to stop him immediately
4. **Connect media** — Sign in to Spotify/YouTube via the top-bar buttons
5. **Voice commands** — Ask Albert to play music, podcasts, or videos

### Example voice commands

| Command | What happens |
|---|---|
| "Play some jazz" | Searches Spotify and starts playback |
| "Play the Huberman Lab podcast" | Finds the show on Spotify and plays the latest episode |
| "Play Bohemian Rhapsody" | Searches YouTube and plays inline |
| "Play my liked videos" | Plays your YouTube liked videos (requires OAuth) |
| "Next track" / "Previous track" | Skips forward or back |
| "Pause" / "Shuffle" | Controls playback |

## Testing

```bash
npx playwright test
```

## Architecture

- **Server** (`server.js`) — Express server handling token brokering, OAuth flows, and Spotify/YouTube API proxying
- **Client** (`client/`) — Vanilla JS frontend with WebRTC session management
  - `js/session.js` — WebRTC peer connection, data channel, mic control, and response cancellation
  - `js/tools.js` — Tool definitions and function call handlers for media playback
  - `js/media-players.js` — YouTube iframe and Spotify playback adapters

## License

MIT
