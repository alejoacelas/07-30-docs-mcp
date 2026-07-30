import { handleRpc } from "../lib/mcp.js";

function originFor(request) {
  const proto = request.headers["x-forwarded-proto"] || "https";
  const host =
    request.headers["x-forwarded-host"] ||
    request.headers.host ||
    "localhost:3000";
  return `${proto}://${host}`;
}

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", "https://claude.ai");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, mcp-protocol-version"
  );
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, DELETE");
  response.setHeader("Vary", "Origin");
}

export default async function handler(request, response) {
  cors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method === "DELETE") {
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS, DELETE");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  let message = request.body;
  if (typeof message === "string") {
    try {
      message = JSON.parse(message);
    } catch {
      response.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" }
      });
      return;
    }
  }

  const result = await handleRpc(message, {
    authorization: request.headers.authorization
  });

  if (result.status === 401) {
    const metadata = `${originFor(request)}/.well-known/oauth-protected-resource/mcp`;
    response.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${metadata}"`
    );
    response.status(401).json({ error: "Google OAuth authorization required" });
    return;
  }
  if (result.body === null) {
    response.status(result.status).end();
    return;
  }
  response
    .status(result.status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .json(result.body);
}
