const DOCS_API = "https://docs.googleapis.com/v1/documents";

export class UpstreamError extends Error {
  constructor(status, body) {
    super(`Google Docs API returned HTTP ${status}`);
    this.name = "UpstreamError";
    this.status = status;
    this.body = body;
  }
}

function bearerHeader(authorization) {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new TypeError("A Google OAuth bearer token is required");
  }
  return authorization;
}

async function googleJson(url, options, fetchImpl) {
  const response = await fetchImpl(url, {
    ...options,
    redirect: "error"
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text || "Empty upstream response" } };
  }
  if (!response.ok) {
    throw new UpstreamError(response.status, body);
  }
  return body;
}

export async function readDocument(args, authorization, fetchImpl = fetch) {
  const query = new URLSearchParams();
  if (args.suggestionsViewMode) {
    query.set("suggestionsViewMode", args.suggestionsViewMode);
  }
  if (args.commentsViewMode) {
    query.set("commentsViewMode", args.commentsViewMode);
  }
  if (typeof args.includeTabsContent === "boolean") {
    query.set("includeTabsContent", String(args.includeTabsContent));
  }

  const suffix = query.size ? `?${query}` : "";
  return googleJson(
    `${DOCS_API}/${encodeURIComponent(args.documentId)}${suffix}`,
    {
      headers: {
        accept: "application/json",
        authorization: bearerHeader(authorization)
      }
    },
    fetchImpl
  );
}

export async function updateDocument(args, authorization, fetchImpl = fetch) {
  const body = { requests: args.requests };
  if (args.writeControl) {
    body.writeControl = args.writeControl;
  }

  return googleJson(
    `${DOCS_API}/${encodeURIComponent(args.documentId)}:batchUpdate`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: bearerHeader(authorization),
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    },
    fetchImpl
  );
}
