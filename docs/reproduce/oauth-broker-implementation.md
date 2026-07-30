# OAuth broker implementation record

## Question

Can an 80,000 Hours-owned remote MCP use the secure structure of Google’s hosted Docs MCP while preserving the preview fields Google’s adapter omits?

## Evidence

On 30 July 2026:

- Google’s protected-resource metadata named Google Accounts as the authorization server and `https://docsmcp.googleapis.com/mcp/v1` as the token resource.
- The live Google MCP schema still exposed only `documentId` for reads and `documentId` plus `requests` for writes.
- The MCP authorization specification required tokens issued for the MCP resource and prohibited forwarding those tokens to an upstream API.

## Implementation

The broker:

1. authenticates Claude to this MCP with Authorization Code and PKCE;
2. obtains a separate Google Docs grant;
3. encrypts the Google grant before storage;
4. gives Claude opaque, short-lived MCP tokens;
5. rotates MCP refresh tokens and consumes codes atomically;
6. rejects Google bearer tokens at the MCP endpoint;
7. refreshes Google access tokens only inside the broker;
8. revokes both the local grant and Google grant.

A free Upstash Redis instance was provisioned for development. It is not the proposed production owner. Production requires an organization-owned deployment, data store, Google client, MCP client, encryption key, administrators, and revocation process.

## Verification

Automated tests cover metadata, the complete authorization flow, token separation, encrypted storage, one-time code use, refresh rotation, audience rejection, and revocation. The production endpoint remains in legacy mode because the development Google client has not been configured with the broker callback and the service has not been transferred to 80,000 Hours-owned accounts.

## Browser limitation

The available browser-control runtime reported no browser session, so the Google Cloud redirect URI and Claude connector could not be changed or visually verified during this run. No production authentication mode was changed without that end-to-end test.
