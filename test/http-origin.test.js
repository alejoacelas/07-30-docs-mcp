import test from "node:test";
import assert from "node:assert/strict";

import { originFor } from "../api/mcp.js";

test("remote metadata prefers the configured canonical origin", () => {
  assert.equal(
    originFor(
      { headers: { host: "attacker.example" } },
      { DOCS_MCP_PUBLIC_ORIGIN: "https://docs.example.org/path" }
    ),
    "https://docs.example.org"
  );
});

test("Vercel production URL is a canonical HTTPS origin", () => {
  assert.equal(
    originFor(
      { headers: {} },
      { VERCEL_PROJECT_PRODUCTION_URL: "docs-mcp.example.vercel.app" }
    ),
    "https://docs-mcp.example.vercel.app"
  );
});

test("invalid proxy origin headers are rejected", () => {
  assert.throws(
    () =>
      originFor(
        {
          headers: {
            "x-forwarded-proto": "javascript",
            "x-forwarded-host": "example.org"
          }
        },
        {}
      ),
    /Invalid proxy origin headers/
  );
});
