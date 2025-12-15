const BASE_URL = "http://127.0.0.1:4096";

async function test() {
  try {
    // Check OpenAPI spec
    console.log("=== OpenAPI Doc - Session Paths ===");
    const docResponse = await fetch(`${BASE_URL}/doc`);
    const doc = await docResponse.json();

    // Find session-related paths
    const sessionPaths = Object.entries(doc.paths || {})
      .filter(([path]) => path.includes("session"));

    for (const [path, methods] of sessionPaths) {
      console.log(`\n${path}:`);
      for (const [method, details] of Object.entries(methods as Record<string, any>)) {
        console.log(`  ${method.toUpperCase()}: ${(details as any).summary || (details as any).operationId || ''}`);
      }
    }

    // Use existing session
    const sessionId = "ses_4ddb76a4effeCCWBYDOqEM5QrT";

    // Try messages endpoint as text
    console.log("\n=== Messages Endpoint (text) ===");
    const messagesResponse = await fetch(`${BASE_URL}/session/${sessionId}/messages`);
    const messagesText = await messagesResponse.text();
    console.log("Content-Type:", messagesResponse.headers.get("content-type"));
    console.log("First 500 chars:", messagesText.slice(0, 500));

    // Check events endpoint (SSE)
    console.log("\n=== Events Endpoint ===");
    const eventsResponse = await fetch(`${BASE_URL}/event`);
    console.log("Events Content-Type:", eventsResponse.headers.get("content-type"));

  } catch (error) {
    console.error("Error:", error);
  }
}

test();
