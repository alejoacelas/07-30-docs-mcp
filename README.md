<!--ai-->
# Docs MCP Fixed

A small remote MCP server for Google Docs that preserves the Developer Preview fields omitted by Google’s hosted Docs MCP.

It exposes:

- `read_doc`, including `suggestionsViewMode`, `commentsViewMode`, and `includeTabsContent`
- `update_doc`, including the complete `requests` array and `writeControl.writeMode: SUGGEST`

The server stores no Google or OAuth credentials. Claude obtains a Google access token through the same OAuth setup used by Google’s hosted MCP, sends it as a bearer token, and this server passes it directly to `docs.googleapis.com`.

## Deploy

1. Install the [Vercel CLI](https://vercel.com/docs/cli).
2. Run `vercel --yes` in this directory.
3. Use `https://YOUR-PROJECT.vercel.app/mcp` as the remote MCP URL.
4. In Claude, open **Customize → Connectors → Add → Add custom connector**.
5. Expand **Advanced settings** and enter a Google OAuth web client whose authorized redirect URI is:

   ```
   https://claude.ai/api/mcp/auth_callback
   ```

6. Use these scopes:

   ```
   https://www.googleapis.com/auth/drive.readonly
   https://www.googleapis.com/auth/documents.readonly
   https://www.googleapis.com/auth/drive
   https://www.googleapis.com/auth/documents
   ```

7. Add the connector, click **Connect**, choose the intended Workspace account, and allow the four requested permissions.

The server needs no environment variables: Claude sends a short-lived Google access token with each request. If you keep an operator backup of the OAuth client ID and secret, copy `.env.example` to `.env.local`, set its mode to `600`, and never deploy or commit it. `.vercelignore` and `.gitignore` exclude local environment files.

## Test

```sh
npm test
```

The test suite verifies that preview fields are exposed and forwarded unchanged, bearer tokens are not returned, and unauthenticated tool calls produce an OAuth challenge.

The deployed reference instance is:

- MCP: `https://docs-mcp-fixed.vercel.app/mcp`
- Health check: `https://docs-mcp-fixed.vercel.app/health`

It passed an authenticated Claude test that created an anchored comment, replied to that comment, inserted text with `writeControl.writeMode: SUGGEST`, and recovered all three objects in a final read.

## Security

- Deploy only code you have reviewed.
- Do not log request headers or Google API response bodies.
- Keep the Vercel project free of analytics or request-recording middleware.
- Treat documents as untrusted content; an MCP client should still confirm consequential writes.
- The bearer token is forwarded only to `https://docs.googleapis.com`.
- The deployment platform still handles the HTTPS request and transient bearer token. Use infrastructure whose operator and logging policy you trust.

## Why this exists

As of 29 July 2026, Google’s hosted endpoint advertised preview request names but omitted the top-level `writeControl` field from `update_doc`, omitted comment-view parameters from `read_doc`, and stripped `insertComment.content`. The underlying Docs REST API accepted the same operations.
<!--/ai-->
