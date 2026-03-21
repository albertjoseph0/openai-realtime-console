# Future Developments

## YouTube Integration (Deferred)

**Status:** All YouTube code is implemented and remains in the codebase but is currently disabled. The AI model does not have YouTube tools registered, so it cannot invoke YouTube functionality.

### What's in place

- **Server endpoints (`server.js`):** YouTube search proxy, Google OAuth2 flow, user playlists, liked videos, playlist items — all routes are live but unused.
- **Tool handler functions (`client/js/tools.js`):** `handlePlayMedia`, `handlePlayPlaylist`, `handlePlayMyPlaylist`, `handlePlayLikedVideos`, `handleListMyPlaylists`, `handlePlaybackControl` — all remain in the file.
- **YouTube IFrame player (`client/js/media-players.js`):** Full player wrapper with load, play, pause, next, prev, shuffle, destroy — intact.
- **Session integration (`client/js/session.js`):** YouTube player pause-on-talk, destroy-on-stop, auth state management — intact.
- **UI (`client/index.html`):** YouTube player container HTML and playlist controls — still in the DOM (hidden by default).

### How to re-enable

1. Restore the YouTube tool definitions to the `sessionUpdate.session.tools` array in `client/js/tools.js`
2. Restore the YouTube entries in the `handlers` map in `client/js/tools.js`
3. Add YouTube tool names back to the `instructions` string
4. Restore the YouTube auth button in `client/index.html`

---

## Spotify Playlist Bookmarks (Voice-Based)

**Problem:** Spotify's personalized/algorithmic playlists (Daylist, Daily Mix, Discover Weekly, etc.) cannot be found via the Spotify Web API Search or Browse endpoints. They *can* be played by URI, but only if you already know it. The Daylist appears in `/me/playlists` once followed, but its name changes constantly (e.g., "chill study power ballad friday afternoon") with no distinguishing metadata.

**Solution:** A voice-driven bookmark system that lets users save name → playlist URI mappings.

### How It Works

1. **Save via voice while listening:** User says *"save this as my daylist"* while the playlist is playing. The agent reads the current playback context URI from `GET /me/player` and stores the mapping (e.g., `"daylist" → spotify:playlist:3GmZguSEONo1CMfdA0Erzs`).

2. **Play by name:** User says *"play my daylist"* → agent checks bookmarks first, finds the URI, plays it directly via `PUT /me/player/play` with `context_uri`. No search needed.

3. **Storage:** Bookmarks stored in a local JSON file (e.g., `spotify-bookmarks.json`). The playlist ID is stable — Spotify updates the content automatically.

### Implementation Notes

- New tool: `spotify_bookmark` with params `name` (alias) and `action` (save/delete/list)
- Modify `spotify_play` to check bookmarks before searching
- `GET /me/player` returns `context.uri` for the currently playing playlist/album/artist
- Works for any unsearchable content, not just Daylist (friend-shared playlists, private playlists, etc.)
- No UI changes needed — fully voice-driven

### Spotify API Research Summary

| Endpoint | Daylist Accessible? | Notes |
|---|---|---|
| `GET /search?q=daylist&type=playlist` | ❌ | Returns unrelated public playlists |
| `GET /me/playlists` | ✅ (if followed) | Shows under dynamic name, not "Daylist" |
| `GET /playlists/{id}` | ✅ (if followed) | Returns metadata, but no "daylist" marker |
| `GET /browse/categories/0JQ5DAt0tbjZptfcdMSKl3/playlists` | ❌ | 403 Forbidden |
| `PUT /me/player/play` with `context_uri` | ✅ | Works — this is how we play it |
| `GET /me/player` | ✅ | Returns `context.uri` of what's currently playing |
