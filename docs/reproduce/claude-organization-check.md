# Claude organization connector check

Checked in the signed-in 80,000 Hours Claude organization on 30 July 2026.

## Findings

- The current user has the Claude Owner role.
- **Organization settings → Connectors** is available and exposes **Add → Custom → Web**.
- The organization already has a custom web connector using Individual sign-in.
- The Add form accepts a remote MCP URL and optional OAuth client ID and secret.
- Managed authorization is a separate Beta option with a Request access link.

These observations match Anthropic’s documentation: an Owner can add a custom remote connector for a Team or Enterprise organization without a separate Anthropic review. Members then connect individually.

The existing connector’s public protected-resource metadata names an Auth0 authorization server, and unauthenticated MCP calls return a protected-resource `401` challenge. That confirms it is not the legacy pattern of advertising Google directly as the authorization server. This check did not establish who owns the Cloud Run project, Auth0 tenant, Google client, token store, or encryption keys, so it does not establish organization ownership of that service.

## Google administrator check

Google Admin Console required password re-verification. No password was entered, and the current user’s Workspace Security Settings privileges were not established. The runbook therefore treats Google API-control access as the remaining role check.
