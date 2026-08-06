---
human_edit_tracking:
  enabled: true
  history: []
---
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
| Organization connector | Claude.ai and other cloud clients | Adds the organization’s hosting and storage providers | End-to-end pilot passed; production ownership and security review remain |
| Personal remote | Claude.ai and other cloud clients | Adds a developer-owned host | Test only; do not use for sensitive documents |

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

## Existing working pilot

The local connector is already configured and connected on this machine:

| Item | Current value |
|---|---|
| Workspace account | `alejandro.acelas-contractor@80000hours.org` |
| Google Cloud project | `agent-cli-tools-alejandro` |
| Project number | `122477011422` |
| Cloud organization | `80000hours.org` (`883222343127`) |
| OAuth client | `~/.config/credentials/google-oauth-client-agent-cli-tools-alejandro.json` |
| Local token | `~/.config/google-docs-preview-mcp/token.json` |
| Claude connector | `google-docs-preview-local` |

Both credential files are ignored, outside this repository and mode `600`; the table
contains no credential value. Google Docs and Drive APIs are enabled, and the tester has
effective Project Owner access. Check the connector with:

```sh
claude mcp get google-docs-preview-local
npm test
```

The pilot has now passed two live workloads: a disposable comment/reply/suggestion test
and a revision-guarded suggested replacement plus evidence comment in a real published
article's source Doc. The [organization pilot record](docs/reproduce/organization-connector-pilot.md)
contains the access evidence; the stale-content finder retains the [real-workflow
readback](../08-04-stale-content-finder/results/2026-08-04/google-doc-suggestion.json).

This proves the local account and Preview API path. It does not make the developer-owned
remote deployment production-ready.

## Organization connector

One Google Cloud project and OAuth app can serve the team. Staff do not create Cloud
projects or handle credentials: a Claude Owner publishes the connector once, then each
registered Preview tester clicks **Connect** and authorizes their own Google account.
Read the [staff onboarding guide](docs/user-onboarding.md), [administrator runbook](docs/organization-owned-remote/runbook.md), and [pilot result](docs/organization-owned-remote/pilot.md).

The pilot deployment is developer-owned. Move the deployment, Redis store, secrets and
administration to 80,000 Hours accounts before approving confidential documents.

## Repository map

```text
api/        Vercel HTTP transport
bin/        Local authorization and stdio entrypoints
src/        Shared MCP and Google Docs logic
test/       Protocol, passthrough, and token-refresh tests
docs/       Setup, security analysis, evidence, and guide images
archive/    Superseded documents retained for context
```

`docs/reproduce/` is the concise maintained path from decisive prompts through
method, scripts, inputs, and checks to the current output.

## Verification

```sh
npm test
```

The test suite covers the preview schema, complete request forwarding, Docs-only scope metadata, canonical remote origins, redirect rejection, local token refresh, file permissions, OAuth challenges, and stateless protocol methods. Claude.ai, Claude Code and Claude Desktop have each passed live reads. The Claude.ai organization pilot created and recovered an anchored comment, its reply and a real unresolved suggestion, then the Google Docs UI was inspected.

## Security status

- Local tokens are plaintext JSON stored outside the repository with mode `600`.
- Docs tool calls construct requests only for the fixed `docs.googleapis.com` origin; local OAuth separately contacts Google’s documented authorization and token endpoints.
- Tool annotations mark writes as destructive, but approval behavior is enforced by the MCP client. Configure per-call approval for writes.
- The remote uses separate MCP and Google tokens. Google grants are encrypted at rest; Claude never receives the Google refresh token.
- The pilot proved one member’s flow. A second user and organizational unit have not
  been tested.
- The pilot host and Redis resources are still developer-owned. Organization ownership,
  admin-led offboarding, rate limits, monitoring and security review remain.

Read [SECURITY.md](SECURITY.md), the [organization-owned deployment decision](docs/organization-owned-remote.md), and the full [threat model](docs/design-and-security.md).
