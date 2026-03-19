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

## License

MIT
