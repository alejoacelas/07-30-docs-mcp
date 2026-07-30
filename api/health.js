export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "google-docs-preview-mcp",
    version: "0.3.0",
    authMode: process.env.DOCS_MCP_AUTH_MODE === "broker" ? "broker" : "legacy"
  });
}
