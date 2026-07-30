import { createOAuthBroker } from "../src/oauth-broker.js";
import { UpstashStore } from "../src/secure-store.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const broker = createOAuthBroker({ store: new UpstashStore() });
    const result = await broker.revoke(
      request.body,
      request.headers.authorization
    );
    response.status(result.status).json(result.body);
  } catch {
    response.status(200).json({});
  }
}
