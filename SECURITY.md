# Security

## Current status

Use the local stdio server for sensitive documents until the remote service is
transferred to approved organization accounts. The remote broker separates MCP and
Google tokens and encrypts Google grants, but its temporary Vercel and Redis resources
are developer-owned.

See [Design and security](docs/design-and-security.md) for the threat model, data flows, mitigations, and production requirements.

The broker revokes the current MCP access token, MCP refresh token and encrypted
Google grant when a user presents either MCP token. It does not yet keep a
subject-to-grant registry or expose an administrator revocation endpoint. Until those
exist, offboarding requires the member to disconnect or a Google Workspace
administrator to revoke the app’s access. Treat that as a production blocker.

## Secrets

Never commit or share:

- OAuth client secrets
- Google access or refresh tokens
- `.env.local`
- `~/.config/google-docs-preview-mcp/token.json`

Local token files are plaintext JSON written with mode `600`. This reduces disclosure to other ordinary local accounts; it is not encryption and does not protect against same-user malware or an administrator. The repository and Vercel ignore local environment files.

## Reporting a vulnerability

Do not open a public issue containing tokens, document content, account identifiers, or exploit details. Contact the repository owner privately and include the affected version, impact, and a minimal reproduction with secrets removed.

## Revocation

If a credential may have leaked:

1. Revoke the app under [Google Account connections](https://myaccount.google.com/connections).
2. Delete the local token file.
3. Remove the connector from Claude. Disconnecting without steps 1–2 does not revoke the Google grant.
4. Rotate the Web OAuth client secret if it was exposed.
5. Inspect provider logs and redeploy from a known commit if a remote service was involved.
