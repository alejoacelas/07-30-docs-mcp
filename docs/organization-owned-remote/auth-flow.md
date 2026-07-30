# How authentication reaches Claude

## Individual sign-in

The organization connector record contains:

- the remote MCP URL;
- the MCP OAuth client ID;
- the MCP OAuth client secret;
- the fact that Individual sign-in is enabled.

This is the only Claude-side organization approval.

When a member clicks **Connect**:

1. Claude reads the MCP’s protected-resource and authorization-server metadata.
2. Claude starts Authorization Code with PKCE against the 80,000 Hours broker.
3. The broker validates Claude’s client ID, callback URI, resource, scope, and PKCE challenge.
4. The broker redirects the member to Google.
5. Google OAuth applies Workspace API controls, the app’s Internal audience, and the user’s consent.
6. Google returns a code to the broker.
7. The broker encrypts the Google grant and sends Claude a separate one-time MCP code.
8. Claude authenticates with the MCP client secret and exchanges the code.
9. Claude stores an MCP access token and rotating refresh token.
10. Tool calls contain the MCP token. The broker resolves it to the corresponding Google grant and calls the Docs API, where Preview registration of the email and project is enforced.

The Owner does not email Anthropic or send it an approval token. Adding the connector makes the configuration available to the organization; the OAuth client credentials prove to the broker that the caller is the configured Claude client.

## Credential ownership

| Credential | Held by | Used for |
| --- | --- | --- |
| Google OAuth client ID and secret | MCP deployment | Broker-to-Google code and refresh exchanges |
| MCP OAuth client ID and secret | Claude organization configuration and MCP deployment | Claude-to-broker client authentication |
| Google refresh token | Encrypted in the MCP’s Redis store | Minting Google access tokens |
| MCP refresh token | Claude and hashed/encrypted server record | Rotating Claude’s MCP session |
| Token-encryption key | MCP deployment secret manager | Encrypting Google grants and broker state |

Do not enter the Google OAuth client secret into Claude for this custom broker. That pattern belongs to Google’s hosted MCP, where Claude authenticates directly with Google. For this implementation, Claude authenticates to the 80,000 Hours broker using the separate MCP client credentials.

## Revocation

| Event | Action |
| --- | --- |
| One user should lose access | Revoke their broker grant and Google grant; disconnect the connector in their Claude account |
| MCP client secret may be exposed | Rotate it in the deployment and Claude organization connector |
| Google client secret may be exposed | Rotate it in Google Cloud and the deployment |
| Encryption key may be exposed | Disable the service, revoke all Google grants, rotate the key, and require every user to reconnect |
| Connector should disappear for everyone | Claude Owner removes the organization connector |
| Staff member leaves | Revoke their grant immediately; Managed authorization can automate this later |

Removing the Claude connector prevents new Claude calls but does not itself prove that Google refresh tokens stored by the MCP were revoked. The operating procedure must revoke and delete server-side grants too.
