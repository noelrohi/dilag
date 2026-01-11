import { createOpencodeClient } from "@opencode-ai/sdk/client";

const client = createOpencodeClient({
  baseUrl: "http://127.0.0.1:4096",
});

async function test() {
  try {
    // List existing sessions
    console.log("=== Listing sessions ===");
    const sessions = await client.session.list({});
    console.log("Sessions:", JSON.stringify(sessions.data, null, 2));

    // Create a new session
    console.log("\n=== Creating session ===");
    const newSession = await client.session.create({});
    console.log("New session:", JSON.stringify(newSession.data, null, 2));

    const sessionId = newSession.data?.id;
    if (!sessionId) {
      console.error("No session ID returned");
      return;
    }

    // Send a message
    console.log("\n=== Sending message ===");
    const response = await client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: "Hello! Say hi back in one word." }],
      },
    });

    console.log("Full response:", JSON.stringify(response, null, 2));
    console.log("\nresponse.data:", JSON.stringify(response.data, null, 2));

    // Check the structure
    if (response.data) {
      console.log("\n=== Response structure ===");
      console.log("Keys in response.data:", Object.keys(response.data));

      const data = response.data as Record<string, unknown>;
      if (data.parts) {
        console.log("Parts:", JSON.stringify(data.parts, null, 2));
      }
      if (data.info) {
        console.log("Info:", JSON.stringify(data.info, null, 2));
      }
    }

    // Get session to see message history
    console.log("\n=== Getting session ===");
    const sessionData = await client.session.get({ path: { id: sessionId } });
    console.log("Session data:", JSON.stringify(sessionData.data, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
