export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "docs-mcp-fixed",
    version: "0.1.0"
  });
}
