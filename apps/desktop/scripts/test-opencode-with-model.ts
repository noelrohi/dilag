const BASE_URL = "http://127.0.0.1:4096";

async function test() {
  try {
    // Create a new session
    console.log("=== Create Session ===");
    const newSession = await fetch(`${BASE_URL}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(r => r.json());
    console.log("Session ID:", newSession.id);

    const sessionId = newSession.id;

    // Initialize the session first
    console.log("\n=== Initialize Session ===");
    const initResponse = await fetch(`${BASE_URL}/session/${sessionId}/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log("Init status:", initResponse.status);
    console.log("Init response:", await initResponse.text());

    // Try sending with model specified
    console.log("\n=== Send Message with Model ===");
    const sendResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", // Try anthropic model
        parts: [{ type: "text", text: "Say hello" }],
      }),
    });
    console.log("Send status:", sendResponse.status);
    const sendResult = await sendResponse.text();
    console.log("Send result:", sendResult);

    // Wait
    await new Promise(r => setTimeout(r, 3000));

    // Get messages
    console.log("\n=== Get Messages ===");
    const messagesResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`);
    const messages = await messagesResponse.json();
    console.log("Messages:", JSON.stringify(messages, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
