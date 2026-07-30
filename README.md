<!--ai-->
# Google Docs Preview MCP

Create anchored comments, replies, and real suggested edits in Google Docs from Claude.

Google’s hosted Docs MCP recognizes the preview operations but does not expose enough of the Docs API schema to use them:

| Operation | Hosted MCP problem | This implementation |
| --- | --- | --- |
| Create comments | Strips `insertComment.content` | Passes the complete request |
| Suggest edits | Omits top-level `writeControl` | Exposes `writeControl.writeMode: SUGGEST` |
| Recover preview objects | Omits comment-view parameters | Exposes comment, suggestion, and tab view controls |

The underlying Google Docs REST API accepts all three operations. See [what failed and why](docs/official-mcp-limitations.md).

## Choose a setup

| Setup | Works in | Trust boundary | Status |
| --- | --- | --- | --- |
| Local stdio | Claude Desktop and Claude Code | Your computer, Google, and Claude | Recommended for sensitive documents; tested |
| Shared remote | Claude.ai and other cloud clients | Adds this project’s Vercel account | Experimental; not recommended for sensitive documents |
| Self-hosted remote | Claude.ai and other cloud clients | Adds your deployment account and hosting provider | Experimental until it uses proper MCP OAuth |

The local server is the current recommendation. Claude.ai cannot connect to localhost or stdio; use Claude Desktop or Claude Code for the local option. Tool results still go to Claude for processing.

The local token file is plaintext JSON protected by Unix file permissions, not an OS keychain. Local execution removes the independent MCP host, but it does not protect against malware running as your user or an administrator.

## Local quick start

```sh
npm test
npm run auth -- --client /path/to/desktop-oauth-client.json
claude mcp add --scope user google-docs-preview-local -- \
  node "$PWD/bin/docs-mcp-local.js"
```

The OAuth flow requests:

```text
https://www.googleapis.com/auth/documents
```

This is the minimum scope for arbitrary document IDs, but Google classifies it as Sensitive and describes it as permission to see, edit, create, and delete all Google Docs documents. A `drive.file` design can narrow access to files a user explicitly selects, but it requires a Google Picker or per-file grant flow that this document-ID-only prototype does not implement.

See the [complete setup guide](docs/setup.md) before authorizing an account.

## Remote test endpoint

```text
https://docs-mcp-fixed.vercel.app/mcp
```

This endpoint is useful for reproducing the adapter fix in Claude.ai. It currently forwards a Google access token unchanged, which the MCP security specification prohibits as token passthrough. Do not treat it as a production shared service. Read [design and security](docs/design-and-security.md) first.

## Repository map

```text
api/        Vercel HTTP transport
bin/        Local authorization and stdio entrypoints
src/        Shared MCP and Google Docs logic
test/       Protocol, passthrough, and token-refresh tests
docs/       Setup, security analysis, evidence, and guide images
```

## Verification

```sh
npm test
```

The test suite covers the preview schema, complete request forwarding, Docs-only scope metadata, canonical remote origins, redirect rejection, local token refresh, file permissions, OAuth challenges, and stateless protocol methods. The local implementation also passed a live comment, reply, and suggest-mode write/read check; Claude Desktop recovered preview comment and suggestion threads through the local connector.

## Security status

- Local tokens are plaintext JSON stored outside the repository with mode `600`.
- Docs tool calls construct requests only for the fixed `docs.googleapis.com` origin; local OAuth separately contacts Google’s documented authorization and token endpoints.
- Tool annotations mark writes as destructive, but approval behavior is enforced by the MCP client. Configure per-call approval for writes.
- The remote transport is experimental until token passthrough is replaced with a separate MCP authorization layer.

Read [SECURITY.md](SECURITY.md) and the full [threat model](docs/design-and-security.md).
<!--/ai-->
