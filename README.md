# Azure OpenAI Realtime Console

This is an example application showing how to use the [Azure OpenAI Realtime API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/realtime-audio-webrtc) with [WebRTC](https://learn.microsoft.com/en-us/azure/foundry/openai/realtime-audio-reference).

## Installation and usage

Before you begin, you'll need:

1. An Azure subscription with a [Microsoft Foundry resource](https://learn.microsoft.com/en-us/azure/ai-services/multi-service-resource)
2. A deployed GPT realtime model (e.g., `gpt-4o-realtime-preview`) in a supported region (East US 2 or Sweden Central)

Create a `.env` file from the example file and set your Azure OpenAI configuration:

```bash
cp .env.example .env
```

Fill in the following values in `.env`:

- `AZURE_OPENAI_ENDPOINT` — Your Azure OpenAI resource endpoint (e.g., `https://my-resource.openai.azure.com`)
- `AZURE_OPENAI_API_KEY` — Your Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT` — Your realtime model deployment name
- `YOUTUBE_API_KEY` — Your [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key (for the play media feature)

#### YouTube OAuth (optional — for personal playlists & liked videos)

To access your personal YouTube playlists and liked videos, you need Google OAuth2 credentials:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one) and enable the **YouTube Data API v3**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Choose **Web application** as the application type
5. Add `http://localhost:3000/auth/google/callback` as an **Authorized redirect URI**
6. Copy the Client ID and Client Secret into your `.env`:

```
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
```

Once configured, click **"Sign in with YouTube"** in the Media Player panel to authenticate. After signing in, you can ask the AI to play your personal playlists or liked videos.

Running this application locally requires [Node.js](https://nodejs.org/) to be installed. Install dependencies for the application with:

```bash
npm install
```

Start the application server with:

```bash
npm run dev
```

This should start the console application on [http://localhost:3000](http://localhost:3000).

This application is a minimal template that uses [express](https://expressjs.com/) to serve the React frontend contained in the [`/client`](./client) folder. The server is configured to use [vite](https://vitejs.dev/) to build the React frontend.

This application shows how to send and receive Realtime API events over the WebRTC data channel and configure client-side function calling. You can also view the JSON payloads for client and server events using the logging panel in the UI.

### Features

- **Voice conversations** — Real-time audio chat via Azure OpenAI Realtime API (WebRTC)
- **Play media** — Ask the AI to play any song or video (e.g., "Play Bohemian Rhapsody by Queen") and it will search YouTube and play it inline via an embedded iframe
- **Personal playlists** — Sign in with YouTube to play your personal playlists and liked videos (e.g., "Play my liked videos", "List my playlists")
- **Color palette** — Ask for color palette suggestions and see them rendered visually

## License

MIT
