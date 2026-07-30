import test from "node:test";
import assert from "node:assert/strict";

import {
  handleRpc,
  protectedResourceMetadata,
  TOOLS
} from "../lib/mcp.js";

test("tool schema exposes preview read and write fields", () => {
  const read = TOOLS.find((tool) => tool.name === "read_doc");
  const update = TOOLS.find((tool) => tool.name === "update_doc");
  assert.ok(read.inputSchema.properties.commentsViewMode);
  assert.ok(read.inputSchema.properties.suggestionsViewMode);
  assert.ok(update.inputSchema.properties.writeControl);
  assert.deepEqual(
    update.inputSchema.properties.writeControl.properties.writeMode.enum,
    ["WRITE_MODE_UNSPECIFIED", "EDIT", "SUGGEST"]
  );
});

test("initialize and tools/list are stateless", async () => {
  const initialized = await handleRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" }
  });
  assert.equal(initialized.status, 200);
  assert.equal(initialized.body.result.serverInfo.name, "docs-mcp-fixed");

  const listed = await handleRpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });
  assert.deepEqual(
    listed.body.result.tools.map((tool) => tool.name),
    ["read_doc", "update_doc"]
  );
});

test("tool call without OAuth returns 401", async () => {
  const result = await handleRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "read_doc",
      arguments: { documentId: "doc" }
    }
  });
  assert.equal(result.status, 401);
});

test("read_doc forwards preview query fields and bearer token", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ documentId: "doc" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const result = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "read_doc",
        arguments: {
          documentId: "doc",
          suggestionsViewMode: "SUGGESTIONS_INLINE",
          commentsViewMode: "COMMENTS_VIEW_MODE_INCLUDED",
          includeTabsContent: true
        }
      }
    },
    { authorization: "Bearer test-token", fetchImpl }
  );
  assert.equal(result.status, 200);
  assert.match(request.url, /suggestionsViewMode=SUGGESTIONS_INLINE/);
  assert.match(request.url, /commentsViewMode=COMMENTS_VIEW_MODE_INCLUDED/);
  assert.match(request.url, /includeTabsContent=true/);
  assert.equal(request.options.headers.authorization, "Bearer test-token");
});

test("update_doc preserves writeControl and preview requests", async () => {
  let forwarded;
  const fetchImpl = async (_url, options) => {
    forwarded = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        documentId: "doc",
        suggestionResponses: [{ suggestionId: "suggest.test" }],
        commentUpdateState: "ALL_SAVED"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  const args = {
    documentId: "doc",
    requests: [
      {
        insertComment: {
          content: "Test",
          range: { startIndex: 1, endIndex: 2 }
        }
      }
    ],
    writeControl: { writeMode: "SUGGEST" }
  };
  const result = await handleRpc(
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "update_doc", arguments: args }
    },
    { authorization: "Bearer test-token", fetchImpl }
  );
  assert.deepEqual(forwarded, {
    requests: args.requests,
    writeControl: { writeMode: "SUGGEST" }
  });
  assert.equal(
    result.body.result.structuredContent.commentUpdateState,
    "ALL_SAVED"
  );
});

test("metadata mirrors Google's OAuth resource-server contract", () => {
  assert.deepEqual(protectedResourceMetadata("https://example.com"), {
    authorization_servers: ["https://accounts.google.com/"],
    bearer_methods_supported: ["header"],
    resource: "https://example.com/mcp",
    scopes_supported: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents"
    ]
  });
});
