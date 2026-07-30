import { createOAuthBroker } from "../src/oauth-broker.js";
import { MemoryStore } from "../src/secure-store.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const broker = createOAuthBroker({ store: new MemoryStore() });
    response
      .status(200)
      .setHeader("Cache-Control", "public, max-age=300")
      .json(broker.authorizationServerMetadata());
  } catch {
    response.status(503).json({ error: "OAuth broker is not configured" });
  }
}
