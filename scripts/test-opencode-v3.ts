const BASE_URL = "http://127.0.0.1:4096";

async function test() {
  try {
    // List sessions
    console.log("=== Sessions ===");
    const sessions = await fetch(`${BASE_URL}/session`).then(r => r.json());
    console.log(JSON.stringify(sessions, null, 2));

    // Create a new session
    console.log("\n=== Create Session ===");
    const newSession = await fetch(`${BASE_URL}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(r => r.json());
    console.log(JSON.stringify(newSession, null, 2));

    const sessionId = newSession.id;

    // Send a message using POST /session/:id/message
    console.log("\n=== Send Message ===");
    const messageResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: [{ type: "text", text: "Say hi in one word" }],
      }),
    }).then(r => r.json());
    console.log("Message response:", JSON.stringify(messageResponse, null, 2));

    // Wait a bit for processing
    await new Promise(r => setTimeout(r, 2000));

    // Get session messages
    console.log("\n=== Get Session Messages ===");
    const sessionData = await fetch(`${BASE_URL}/session/${sessionId}`).then(r => r.json());
    console.log("Session:", JSON.stringify(sessionData, null, 2));

    // Try messages endpoint
    console.log("\n=== Try Messages Endpoint ===");
    const messagesResponse = await fetch(`${BASE_URL}/session/${sessionId}/messages`);
    console.log("Status:", messagesResponse.status);
    if (messagesResponse.ok) {
      const messages = await messagesResponse.json();
      console.log("Messages:", JSON.stringify(messages, null, 2));
    } else {
      console.log("Response:", await messagesResponse.text());
    }

    // Check OpenAPI spec
    console.log("\n=== OpenAPI Doc ===");
    const docResponse = await fetch(`${BASE_URL}/doc`);
    const doc = await docResponse.json();
    // Find session-related paths
    const sessionPaths = Object.keys(doc.paths || {}).filter(p => p.includes("session"));
    console.log("Session paths:", sessionPaths);

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
