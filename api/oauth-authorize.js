import { createOAuthBroker } from "../src/oauth-broker.js";
import { UpstashStore } from "../src/secure-store.js";

export default async function handler(request, response) {
  try {
    const broker = createOAuthBroker({ store: new UpstashStore() });
    if (request.method === "GET") {
      response
        .status(200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .setHeader("Cache-Control", "no-store")
        .send(broker.consentPage(request.query));
      return;
    }
    if (request.method === "POST") {
      const location = await broker.approveAuthorization(request.body);
      response.redirect(302, location);
      return;
    }
    response.setHeader("Allow", "GET, POST");
    response.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    response
      .status(400)
      .setHeader("Cache-Control", "no-store")
      .json({ error: "invalid_request", error_description: error.message });
  }
}
