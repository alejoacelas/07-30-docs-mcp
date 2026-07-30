import {
  readDocument,
  updateDocument,
  UpstreamError
} from "./google-docs.js";

export const SCOPES = [
  "https://www.googleapis.com/auth/documents"
];

const suggestionsViewMode = {
  type: "string",
  enum: [
    "DEFAULT_FOR_CURRENT_ACCESS",
    "SUGGESTIONS_INLINE",
    "PREVIEW_SUGGESTIONS_ACCEPTED",
    "PREVIEW_WITHOUT_SUGGESTIONS"
  ]
};

const commentsViewMode = {
  type: "string",
  enum: [
    "COMMENTS_VIEW_MODE_UNSPECIFIED",
    "COMMENTS_VIEW_MODE_DEFAULT_FOR_CURRENT_ACCESS",
    "COMMENTS_VIEW_MODE_OMITTED",
    "COMMENTS_VIEW_MODE_INCLUDED"
  ]
};

export const TOOLS = [
  {
    name: "read_doc",
    title: "Read Google Doc",
    description:
      "Read a Google Doc through the Google Docs API. Set suggestionsViewMode to SUGGESTIONS_INLINE for write-compatible indexes and commentsViewMode to COMMENTS_VIEW_MODE_INCLUDED to retrieve preview comments and suggestion threads. When commentsViewMode is present, includeTabsContent defaults to true because Google requires both parameters together.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "Google Docs document ID, not the complete URL."
        },
        suggestionsViewMode,
        commentsViewMode,
        includeTabsContent: {
          type: "boolean",
          description:
            "When true, document content is returned under Document.tabs."
        }
      },
      required: ["documentId"],
      additionalProperties: false
    }
  },
  {
    name: "update_doc",
    title: "Update Google Doc",
    description:
      "Apply a Google Docs documents.batchUpdate request without stripping preview fields. Supports insertComment, addCommentReply, suggestion management, and writeControl.writeMode SUGGEST.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "Google Docs document ID, not the complete URL."
        },
        requests: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: true
          },
          description:
            "Google Docs API Request objects in documents.batchUpdate order. Anchored comment: {\"insertComment\":{\"range\":{\"startIndex\":1,\"endIndex\":5,\"tabId\":\"t.0\"},\"content\":\"Review this\"}}. Reply: {\"addCommentReply\":{\"commentId\":\"COMMENT_ID\",\"post\":{\"content\":\"Reply text\"}}}."
        },
        writeControl: {
          type: "object",
          properties: {
            writeMode: {
              type: "string",
              enum: ["WRITE_MODE_UNSPECIFIED", "EDIT", "SUGGEST"]
            },
            requiredRevisionId: { type: "string" },
            targetRevisionId: { type: "string" }
          },
          additionalProperties: false,
          description:
            "Set writeMode to SUGGEST to create suggestions instead of direct edits."
        }
      },
      required: ["documentId", "requests"],
      additionalProperties: false
    }
  }
];

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function toolResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value)
      }
    ],
    structuredContent: value
  };
}

function toolError(error) {
  const upstream = error instanceof UpstreamError;
  const details = upstream
    ? error.body
    : { error: { message: error instanceof Error ? error.message : String(error) } };
  return {
    content: [{ type: "text", text: JSON.stringify(details) }],
    isError: true
  };
}

function requireToolArguments(params) {
  if (!params || typeof params.name !== "string") {
    throw new TypeError("tools/call requires a tool name");
  }
  if (!params.arguments || typeof params.arguments !== "object") {
    throw new TypeError("tools/call requires an arguments object");
  }
}

export async function handleRpc(
  message,
  { authorization, fetchImpl = fetch } = {}
) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return {
      status: 400,
      body: rpcError(message?.id, -32600, "Invalid JSON-RPC request")
    };
  }

  if (message.method === "notifications/initialized") {
    return { status: 202, body: null };
  }

  if (message.method === "initialize") {
    const requested = message.params?.protocolVersion;
    const protocolVersion =
      typeof requested === "string" ? requested : "2025-06-18";
    return {
      status: 200,
      body: rpcResult(message.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "google-docs-preview-mcp",
          version: "0.3.0"
        },
        instructions:
          "Use read_doc with suggestions inline before index-based writes. Use update_doc with writeControl.writeMode SUGGEST for suggested edits. Never substitute a direct edit when the user requests a suggestion."
      })
    };
  }

  if (message.method === "ping") {
    return { status: 200, body: rpcResult(message.id, {}) };
  }

  if (message.method === "tools/list") {
    return {
      status: 200,
      body: rpcResult(message.id, { tools: TOOLS })
    };
  }

  if (message.method === "tools/call") {
    if (!authorization?.startsWith("Bearer ")) {
      return { status: 401, body: null };
    }
    try {
      requireToolArguments(message.params);
      const { name, arguments: args } = message.params;
      let value;
      if (name === "read_doc") {
        value = await readDocument(args, authorization, fetchImpl);
      } else if (name === "update_doc") {
        value = await updateDocument(args, authorization, fetchImpl);
      } else {
        return {
          status: 200,
          body: rpcResult(message.id, toolError(new Error(`Unknown tool: ${name}`)))
        };
      }
      return { status: 200, body: rpcResult(message.id, toolResult(value)) };
    } catch (error) {
      return {
        status: 200,
        body: rpcResult(message.id, toolError(error))
      };
    }
  }

  return {
    status: 200,
    body: rpcError(message.id, -32601, `Method not found: ${message.method}`)
  };
}

export function protectedResourceMetadata(origin) {
  return {
    authorization_servers: ["https://accounts.google.com/"],
    bearer_methods_supported: ["header"],
    resource: `${origin}/mcp`,
    scopes_supported: SCOPES
  };
}
