import { test, expect } from "@playwright/test";

/**
 * Test: Clicking Talk while agent is responding sends response.cancel
 * and stops the agent's response stream.
 */
test.describe("Response Cancel on Talk Button", () => {
  test("sends response.cancel when Talk is clicked during agent response", async ({
    page,
  }) => {
    // Track all messages sent through the data channel
    const sentMessages = [];
    const receivedEvents = [];

    // Collect console logs
    const consoleLogs = [];
    page.on("console", (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    // Mock WebRTC and getUserMedia before page loads
    await page.addInitScript(() => {
      // Store references for later use
      window.__mockDC = null;
      window.__dcMessages = [];

      // Mock getUserMedia
      navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start();
        return dest.stream;
      };

      // Mock RTCPeerConnection
      const OriginalRTC = window.RTCPeerConnection;
      window.RTCPeerConnection = class MockRTCPeerConnection {
        constructor() {
          this._senders = [];
          this._dc = null;
          this.ontrack = null;
        }

        addTrack(track) {
          this._senders.push({ track });
        }

        getSenders() {
          return this._senders;
        }

        createDataChannel(name) {
          const listeners = {};
          const dc = {
            label: name,
            readyState: "open",
            addEventListener(event, cb) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(cb);
            },
            removeEventListener(event, cb) {
              if (listeners[event]) {
                listeners[event] = listeners[event].filter((f) => f !== cb);
              }
            },
            send(data) {
              window.__dcMessages.push(JSON.parse(data));
            },
            close() {
              this.readyState = "closed";
            },
            // Expose dispatch for simulating server events
            _dispatch(event, data) {
              (listeners[event] || []).forEach((cb) => cb(data));
            },
            _listeners: listeners,
          };
          this._dc = dc;
          window.__mockDC = dc;

          // Auto-fire "open" after a short delay to simulate connection
          setTimeout(() => {
            dc._dispatch("open", {});
          }, 100);

          return dc;
        }

        async createOffer() {
          return {
            type: "offer",
            sdp: "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n",
          };
        }

        async setLocalDescription() {}
        async setRemoteDescription() {}

        close() {}
      };
    });

    // Mock HTTP endpoints
    await page.route("/token", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          value: "test-ephemeral-key",
          endpoint: "https://test.openai.example.com",
        }),
      }),
    );

    await page.route("**/openai/v1/realtime/calls", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/sdp",
        body: "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:test\r\na=ice-pwd:test\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:active\r\na=mid:0\r\na=sendrecv\r\na=rtpmap:111 opus/48000/2\r\n",
      }),
    );

    await page.route("/auth/spotify/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      }),
    );

    await page.route("/auth/google/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      }),
    );

    // Load the page
    await page.goto("/");

    // 1. Click Start Session
    const startBtn = page.getByTestId("start-session-btn");
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Wait for the mock data channel to open and Talk button to appear
    const talkBtn = page.getByTestId("talk-btn");
    await expect(talkBtn).toBeVisible({ timeout: 5000 });

    // 2. Click Talk (first click — user starts talking, isTalking = true)
    await talkBtn.click();
    await page.waitForTimeout(200);

    // Button should now show "Listening..."
    let btnText = await talkBtn.textContent();
    expect(btnText).toContain("Listening");

    // Clear DC messages from the first click (cancel was sent but agent
    // wasn't talking yet so it was a no-op on the server side)
    await page.evaluate(() => {
      window.__dcMessages = [];
    });

    // 3. User speaks. Agent processes speech and starts responding.
    //    Simulate the agent sending back response events while isTalking
    //    is still true and button still shows "Listening..."
    await page.evaluate(() => {
      const dc = window.__mockDC;

      const agentEvents = [
        {
          type: "response.created",
          response: { id: "resp_001", status: "in_progress" },
        },
        {
          type: "response.audio_transcript.delta",
          delta: "I'm doing great, ",
        },
        {
          type: "response.audio_transcript.done",
          transcript: "I'm doing great, thanks for asking!",
        },
        // Agent continues with a follow-up response
        {
          type: "response.created",
          response: { id: "resp_002", status: "in_progress" },
        },
        {
          type: "response.audio_transcript.delta",
          delta: "How about you? ",
        },
      ];

      for (const event of agentEvents) {
        dc._dispatch("message", { data: JSON.stringify(event) });
      }
    });

    await page.waitForTimeout(200);

    // VERIFY: the AI response was logged — the agent IS talking
    const aiLogsBeforeCancel = consoleLogs.filter((l) =>
      l.text.includes("[AI RESPONSE]"),
    );
    expect(aiLogsBeforeCancel.length).toBe(1);
    expect(aiLogsBeforeCancel[0].text).toContain(
      "I'm doing great, thanks for asking!",
    );

    // Button should STILL show "Listening..." (isTalking is still true)
    btnText = await talkBtn.textContent();
    expect(btnText).toContain("Listening");

    // Clear DC messages so we only see what happens on the second click
    await page.evaluate(() => {
      window.__dcMessages = [];
    });

    // 4. User clicks "Listening..." button AGAIN to stop the agent.
    //    This is the key scenario — isTalking is true, agent is mid-response.
    await talkBtn.click();
    await page.waitForTimeout(200);

    // 5. VERIFY: response.cancel AND output_audio_buffer.clear were sent
    const dcMessages = await page.evaluate(() => window.__dcMessages);
    const cancelMessage = dcMessages.find(
      (msg) => msg.type === "response.cancel",
    );
    expect(cancelMessage).toBeTruthy();
    expect(cancelMessage.event_id).toBeTruthy();

    const clearAudioMessage = dcMessages.find(
      (msg) => msg.type === "output_audio_buffer.clear",
    );
    expect(clearAudioMessage).toBeTruthy();

    // response.cancel should come before output_audio_buffer.clear
    const cancelIdx = dcMessages.indexOf(cancelMessage);
    const clearIdx = dcMessages.indexOf(clearAudioMessage);
    expect(cancelIdx).toBeLessThan(clearIdx);

    // Record AI log count right after cancel
    const aiLogCountAtCancel = consoleLogs.filter((l) =>
      l.text.includes("[AI RESPONSE]"),
    ).length;

    // Simulate server acknowledging the cancel
    await page.evaluate(() => {
      const dc = window.__mockDC;
      dc._dispatch("message", {
        data: JSON.stringify({
          type: "response.cancelled",
          response: { id: "resp_002" },
        }),
      });
    });

    await page.waitForTimeout(100);

    // No new [AI RESPONSE] log — the second response was cancelled
    const aiLogCountAfterCancel = consoleLogs.filter((l) =>
      l.text.includes("[AI RESPONSE]"),
    ).length;
    expect(aiLogCountAfterCancel).toBe(aiLogCountAtCancel);

    // 6. VERIFY: Button toggled back to "Talk" (not "Listening...")
    const btnTextAfterCancel = await talkBtn.textContent();
    expect(btnTextAfterCancel).toContain("Talk");
  });

  test("sends response.cancel on EVERY click, even when already talking", async ({
    page,
  }) => {
    // Same mock setup
    await page.addInitScript(() => {
      window.__mockDC = null;
      window.__dcMessages = [];

      navigator.mediaDevices.getUserMedia = async () => {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const dest = ctx.createMediaStreamDestination();
        oscillator.connect(dest);
        oscillator.start();
        return dest.stream;
      };

      window.RTCPeerConnection = class MockRTCPeerConnection {
        constructor() {
          this._senders = [];
        }
        addTrack(track) {
          this._senders.push({ track });
        }
        getSenders() {
          return this._senders;
        }
        createDataChannel(name) {
          const listeners = {};
          const dc = {
            label: name,
            readyState: "open",
            addEventListener(event, cb) {
              if (!listeners[event]) listeners[event] = [];
              listeners[event].push(cb);
            },
            removeEventListener() {},
            send(data) {
              window.__dcMessages.push(JSON.parse(data));
            },
            close() {},
            _dispatch(event, data) {
              (listeners[event] || []).forEach((cb) => cb(data));
            },
          };
          window.__mockDC = dc;
          setTimeout(() => dc._dispatch("open", {}), 100);
          return dc;
        }
        async createOffer() {
          return { type: "offer", sdp: "v=0\r\n" };
        }
        async setLocalDescription() {}
        async setRemoteDescription() {}
        close() {}
      };
    });

    await page.route("/token", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          value: "test-key",
          endpoint: "https://test.openai.example.com",
        }),
      }),
    );
    await page.route("**/openai/v1/realtime/calls", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/sdp",
        body: "v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:test\r\na=ice-pwd:test\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:active\r\na=mid:0\r\na=sendrecv\r\na=rtpmap:111 opus/48000/2\r\n",
      }),
    );
    await page.route("/auth/spotify/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      }),
    );
    await page.route("/auth/google/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      }),
    );

    await page.goto("/");

    const startBtn = page.getByTestId("start-session-btn");
    await startBtn.click();

    const talkBtn = page.getByTestId("talk-btn");
    await expect(talkBtn).toBeVisible({ timeout: 5000 });

    // Clear messages
    await page.evaluate(() => {
      window.__dcMessages = [];
    });

    // First click — sends response.cancel + output_audio_buffer.clear, sets isTalking = true
    await talkBtn.click();
    await page.waitForTimeout(200);

    const messagesAfterFirst = await page.evaluate(() =>
      window.__dcMessages.slice(),
    );
    expect(
      messagesAfterFirst.filter((m) => m.type === "response.cancel").length,
    ).toBe(1);
    expect(
      messagesAfterFirst.filter((m) => m.type === "output_audio_buffer.clear").length,
    ).toBe(1);

    // Second click while already talking — should STILL send both events
    await talkBtn.click();
    await page.waitForTimeout(200);

    const messagesAfterSecond = await page.evaluate(() =>
      window.__dcMessages.slice(),
    );
    expect(
      messagesAfterSecond.filter((m) => m.type === "response.cancel").length,
    ).toBe(2);
    expect(
      messagesAfterSecond.filter((m) => m.type === "output_audio_buffer.clear").length,
    ).toBe(2);
  });
});
