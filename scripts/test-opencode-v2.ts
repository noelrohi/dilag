import { createOpencodeClient } from "@opencode-ai/sdk/client";

const client = createOpencodeClient({
  baseUrl: "http://127.0.0.1:4096",
});

async function test() {
  try {
    // Use an existing session with messages
    const sessionId = "ses_4ddbacc85ffet1vKbp0G8gZM5w";

    // Try the message endpoint
    console.log("=== Checking client methods ===");
    console.log("session methods:", Object.keys(client.session));

    // Check if there's a messages method
    console.log("\n=== Trying session.message ===");

    // Send via message endpoint if available
    const messageResponse = await (client.session as any).message?.({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: "Say hello" }],
      },
    });
    console.log("Message response:", JSON.stringify(messageResponse, null, 2));

    // Try listing messages
    console.log("\n=== Checking for messages in session ===");
    const sessionData = await client.session.get({ path: { id: sessionId } });
    console.log("Session keys:", Object.keys(sessionData.data || {}));

    // Let's look at what the actual API returns
    console.log("\n=== Raw fetch to messages endpoint ===");
    const rawResponse = await fetch(`http://127.0.0.1:4096/session/${sessionId}/messages`);
    const messages = await rawResponse.json();
    console.log("Messages:", JSON.stringify(messages, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
