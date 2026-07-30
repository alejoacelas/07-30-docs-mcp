import { protectedResourceMetadata } from "../src/mcp.js";
import { originFor } from "../src/http-origin.js";
import { createOAuthBroker } from "../src/oauth-broker.js";
import { MemoryStore } from "../src/secure-store.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  const metadata =
    process.env.DOCS_MCP_AUTH_MODE === "broker"
      ? createOAuthBroker({ store: new MemoryStore() })
          .protectedResourceMetadata()
      : protectedResourceMetadata(originFor(request));
  response
    .status(200)
    .setHeader("Cache-Control", "public, max-age=300")
    .json(metadata);
}
