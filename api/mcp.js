import { handleRpc } from "../src/mcp.js";

function firstHeader(value) {
  return String(value || "").split(",")[0].trim();
}

export function originFor(request, env = process.env) {
  const configured =
    env.DOCS_MCP_PUBLIC_ORIGIN ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  if (configured) {
    const url = new URL(configured);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("DOCS_MCP_PUBLIC_ORIGIN must be an HTTP(S) origin");
    }
    return url.origin;
  }

  const proto = firstHeader(request.headers["x-forwarded-proto"]) || "https";
  const host =
    firstHeader(request.headers["x-forwarded-host"]) ||
    firstHeader(request.headers.host) ||
    "localhost:3000";
  if (!/^(https|http)$/.test(proto) || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    throw new Error("Invalid proxy origin headers");
  }
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
