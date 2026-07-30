export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "google-docs-preview-mcp",
    version: "0.2.1"
  });
}
