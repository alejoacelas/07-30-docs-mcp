# Organization-owned deployment runbook

## Outcome

At the end:

- the MCP runs at an 80,000 Hours-owned HTTPS origin;
- the health route reports `"authMode": "broker"`;
- a Claude Owner has added one organization custom connector;
- each registered staff member can connect their own Google account;
- Claude receives MCP tokens, not Google tokens;
- comments, replies, and suggested edits pass on a disposable document.

## 0. Assign owners

Record names for:

- service owner;
- Google Cloud and OAuth owner;
- Google Workspace Security Settings administrator;
- Claude Owner;
- hosting and Redis owner;
- incident and offboarding owner.

One person may hold several roles. Use at least two administrators for production credentials and deployment access.

## 1. Register Google Preview access

1. Select or create the organization-owned Google Cloud project.
2. Record its numeric project number.
3. Submit the [Google Workspace Developer Preview application](https://docs.google.com/forms/d/e/1FAIpQLSd7BiMXXHDlUDkF7G0TSY5zfJbQwFNH3m6K_ZYFi3vCHLFbng/viewform) with the first tester’s Workspace email and project number.
4. Wait for both confirmation emails: Google first verifies the Workspace account, then registers the Cloud project.
5. For additional testers, use the program’s [email-address request](https://docs.google.com/forms/d/e/1FAIpQLScXoXMKj6pzgLNXzwuA2n4kWfFXgebXO8pJy6aZzH9C4hmw5w/viewform).
6. If the production project differs from the original test project, use the program’s [Cloud-project request](https://docs.google.com/forms/d/e/1FAIpQLSebRuwRJzPYpIGAg2HcEhX7uVDjbCvABb2hNsrrTWj9PaPPKw/viewform).

Do not proceed from “form submitted.” Confirm that both the tester’s email and the production project are registered.

## 2. Create the organization-owned Google app

The operator needs Project Creator on the chosen organization or folder if the project does not exist, then OAuth Config Editor or broader project edit access.

1. Enable `docs.googleapis.com`.
2. Under **Google Auth Platform → Branding**, configure an organization support address.
3. Set **Audience** to **Internal**.
4. Under **Data access**, add only:

   ```text
   https://www.googleapis.com/auth/documents
   ```

5. Create a **Web application** OAuth client.
6. Add the exact redirect:

   ```text
   https://YOUR-PRODUCTION-ORIGIN/oauth/google/callback
   ```

7. Save the Google client ID and secret directly into the organization’s secret manager.

The custom MCP calls `docs.googleapis.com`; it does not require `docsmcp.googleapis.com`.

## 3. Have Workspace approve the client

Ask a Workspace Security Settings administrator to configure the exact Google OAuth client ID:

1. **Admin Console → Security → Access and data control → API controls**.
2. **Manage App Access → Configure new app**.
3. Search by client ID.
4. Apply it to the pilot organizational unit.
5. Choose **Specific Google data**.
6. Permit only the Docs scope.
7. Save and record the decision.

This step can be skipped only after confirming that current Internal-app and Docs-service policies already permit the client. A successful sign-in by one developer does not prove that every staff organizational unit has the same policy.

## 4. Put every runtime component under organization ownership

Choose one:

- transfer the existing development deployment and Redis resource into organization teams; or
- create fresh production resources in organization accounts.

The second option leaves a cleaner audit trail.

Required components:

| Component | Requirement |
| --- | --- |
| HTTPS deployment | Stable origin controlled by 80,000 Hours |
| Redis | Atomic `GETDEL`, TLS, organization billing and administrators |
| Secret manager | Google client secret, MCP client secret, and encryption key |
| Domain or provider hostname | Must not change after OAuth callbacks are registered |
| Source deployment | Built from a reviewed commit |

If Vercel and Upstash are not approved subprocessors, deploy to an approved equivalent. The code currently expects Upstash’s REST interface; changing storage requires an adapter with atomic one-time consumption.

## 5. Configure and deploy the broker

Generate a random MCP client secret and a 32-byte base64url token-encryption key directly into the secret manager.

Configure:

```text
DOCS_MCP_AUTH_MODE=broker
DOCS_MCP_PUBLIC_ORIGIN=https://YOUR-PRODUCTION-ORIGIN
DOCS_MCP_TOKEN_KEY=<32 random bytes, base64url>
GOOGLE_OAUTH_CLIENT_ID=<Google Web OAuth client ID>
GOOGLE_OAUTH_CLIENT_SECRET=<Google Web OAuth client secret>
MCP_OAUTH_CLIENT_ID=<identifier chosen for Claude>
MCP_OAUTH_CLIENT_SECRET=<independent random secret>
MCP_REDIRECT_URI=https://claude.ai/api/mcp/auth_callback
UPSTASH_REST_URL=<Redis REST URL>
UPSTASH_REST_TOKEN=<Redis REST token>
```

Then:

```sh
npm test
npm run check:docs
vercel --prod --yes
```

Use the equivalent deployment command on another host.

Verify before touching Claude:

```sh
curl https://YOUR-PRODUCTION-ORIGIN/health
curl https://YOUR-PRODUCTION-ORIGIN/.well-known/oauth-protected-resource/mcp
curl https://YOUR-PRODUCTION-ORIGIN/.well-known/oauth-authorization-server
curl -i https://YOUR-PRODUCTION-ORIGIN/mcp
```

Required results:

- health reports `ok: true` and `authMode: broker`;
- protected-resource metadata names `https://YOUR-PRODUCTION-ORIGIN/mcp`;
- authorization metadata names the same origin as issuer;
- unauthenticated `/mcp` returns `401` with the protected-resource metadata URL;
- no metadata points directly to Google as the MCP authorization server.

## 6. Add the connector to the Claude organization

A Claude Owner performs this step. Individual members cannot publish a custom connector to a Team or Enterprise organization.

1. Open [Organization settings → Connectors](https://claude.ai/admin-settings/connectors).
2. Click **Add → Custom → Web**.
3. Name it `Google Docs Preview`.
4. Enter:

   ```text
   https://YOUR-PRODUCTION-ORIGIN/mcp
   ```

5. Under **Advanced settings**, enter `MCP_OAUTH_CLIENT_ID` and `MCP_OAUTH_CLIENT_SECRET`.
6. Leave **Individual sign-in** enabled.
7. Add the connector.

![Claude organization custom connector form; callouts mark the MCP URL, MCP client credentials, and Individual sign-in](../images/guide/32-claude-org-custom-connector.png)

This action is the Claude organization approval. Do not apply for Managed authorization unless central identity-provider provisioning is a separate requirement.

## 7. Connect each tester

Each registered tester:

1. Opens **Customize → Connectors**.
2. Finds `Google Docs Preview`.
3. Clicks **Connect**.
4. Reviews the organization broker page.
5. Signs into the registered Workspace account at Google.
6. Confirms the consent screen requests only Google Docs access.
7. Returns to Claude with the connector shown as connected.
8. Enables it for a disposable test conversation.

If Google blocks the app:

- confirm the user email and Cloud project are registered for Developer Preview;
- confirm the OAuth audience is Internal;
- confirm Workspace API controls allow the exact client ID and Docs scope;
- inspect OAuth log events in the Google Admin security investigation tool.

## 8. Prove token separation

Before testing document writes:

- send a Google access token to `/mcp` and confirm it is rejected;
- send an MCP token to Google’s Docs API and confirm it is rejected;
- confirm Redis does not contain the Google refresh token in plaintext;
- reuse an authorization code and confirm the second exchange fails;
- refresh once, then replay the old MCP refresh token and confirm it fails;
- revoke the grant and confirm both the local grant and Google grant are unusable.

The automated suite covers these invariants. The live checks prove that the deployed environment matches the source configuration.

## 9. Test the Docs workflow

Use the [verification prompt](../testing.md) on a disposable document. Keep write-tool approval set to per-call.

Pass only if:

- the comment is anchored to the requested text;
- the reply is in the same thread;
- the edit appears as a suggestion, not an accepted direct edit;
- a new session can read back the comment, reply, and suggestion;
- the final document is visually inspected in Google Docs.

## 10. Pilot and production gates

Pilot:

- named testers only;
- non-confidential documents;
- provider logging and retention reviewed;
- user and emergency revocation tested;
- deployment and Redis access limited to named staff;
- one person other than the developer can execute the offboarding procedure.

Production:

- internal security approval recorded;
- subprocessors and data flow documented;
- request size, rate, and timeout limits added;
- monitoring detects replay and abnormal write volume without recording document bodies or tokens;
- encryption-key rotation and full-grant revocation exercised;
- the Google Preview terms still permit the intended use.
