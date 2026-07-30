import { createOAuthBroker } from "../src/oauth-broker.js";
import { UpstashStore } from "../src/secure-store.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const broker = createOAuthBroker({ store: new UpstashStore() });
    const location = await broker.completeGoogle(request.query);
    response.redirect(302, location);
  } catch (error) {
    response
      .status(400)
      .setHeader("Cache-Control", "no-store")
      .json({ error: "invalid_grant", error_description: error.message });
  }
}
