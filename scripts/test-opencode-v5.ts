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

    // Send a message
    console.log("\n=== Send Message ===");
    const sendResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: [{ type: "text", text: "Say 'Hello World' and nothing else" }],
      }),
    });
    console.log("Send status:", sendResponse.status);
    const sendResult = await sendResponse.text();
    console.log("Send result:", sendResult);

    // Wait for processing
    console.log("\n=== Waiting for response... ===");
    await new Promise(r => setTimeout(r, 5000));

    // Get messages
    console.log("\n=== Get Messages ===");
    const messagesResponse = await fetch(`${BASE_URL}/session/${sessionId}/message`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    console.log("Messages status:", messagesResponse.status);
    console.log("Content-Type:", messagesResponse.headers.get("content-type"));

    const messagesText = await messagesResponse.text();
    console.log("Messages response:", messagesText.slice(0, 2000));

    // Try parsing if JSON
    try {
      const messages = JSON.parse(messagesText);
      console.log("\n=== Parsed Messages ===");
      console.log(JSON.stringify(messages, null, 2));
    } catch {
      console.log("Not JSON");
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
