const BASE_URL = "http://127.0.0.1:4096";

async function test() {
  // Get an existing session
  const sessions = await fetch(`${BASE_URL}/session`).then(r => r.json());
  const sessionId = sessions[0]?.id;
  console.log("Using session:", sessionId);

  // Connect to SSE
  console.log("\n=== Connecting to SSE events ===");

  const eventsPromise = (async () => {
    const response = await fetch(`${BASE_URL}/event`, {
      headers: { "Accept": "text/event-stream" },
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const timeout = setTimeout(() => {
      console.log("\n=== Timeout - closing SSE ===");
      reader?.cancel();
    }, 10000);

    try {
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              console.log("Event:", JSON.stringify(parsed, null, 2).slice(0, 500));
            } catch {
              console.log("Event (raw):", data.slice(0, 200));
            }
          }
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  })();

  // Wait a bit then send a message
  await new Promise(r => setTimeout(r, 1000));

  console.log("\n=== Sending message ===");
  const sendResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts: [{ type: "text", text: "Say hello" }],
    }),
  });
  console.log("Send status:", sendResponse.status);

  await eventsPromise;
}

test().catch(console.error);
