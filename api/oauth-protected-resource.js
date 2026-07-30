import { protectedResourceMetadata } from "../lib/mcp.js";

function originFor(request) {
  const proto = request.headers["x-forwarded-proto"] || "https";
  const host =
    request.headers["x-forwarded-host"] ||
    request.headers.host ||
    "localhost:3000";
  return `${proto}://${host}`;
}

export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }
  response
    .status(200)
    .setHeader("Cache-Control", "public, max-age=300")
    .json(protectedResourceMetadata(originFor(request)));
}
