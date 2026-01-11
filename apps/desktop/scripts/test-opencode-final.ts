const BASE_URL = "http://127.0.0.1:4096";

async function test() {
  try {
    // Get available providers to find one with a key
    console.log("=== Check Providers ===");
    const providers = await fetch(`${BASE_URL}/provider`).then(r => r.json());

    // Find anthropic provider
    const anthropic = providers.all?.find((p: any) => p.id === "anthropic");
    if (anthropic) {
      console.log("Anthropic provider found:", Object.keys(anthropic.models || {}));
    }

    // Create a new session
    console.log("\n=== Create Session ===");
    const newSession = await fetch(`${BASE_URL}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(r => r.json());
    console.log("Session ID:", newSession.id);

    const sessionId = newSession.id;

    // Send message with proper model object
    console.log("\n=== Send Message ===");
    const sendResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: {
          providerID: "anthropic",
          modelID: "claude-sonnet-4-20250514",
        },
        parts: [{ type: "text", text: "Say 'hello' and nothing else" }],
      }),
    });
    console.log("Send status:", sendResponse.status);
    const sendResult = await sendResponse.text();
    console.log("Send result:", sendResult);

    // Wait for processing
    console.log("\nWaiting for response...");
    await new Promise(r => setTimeout(r, 5000));

    // Get messages
    console.log("\n=== Get Messages ===");
    const messagesResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`);
    const messages = await messagesResponse.json();
    console.log("Messages:", JSON.stringify(messages, null, 2));

    // If still empty, try getting session details
    console.log("\n=== Session Details ===");
    const sessionDetails = await fetch(`${BASE_URL}/session/${sessionId}`).then(r => r.json());
    console.log("Session:", JSON.stringify(sessionDetails, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
