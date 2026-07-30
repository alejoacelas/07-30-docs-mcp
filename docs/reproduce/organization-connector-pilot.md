<!--ai-->
# Reproduce the organization connector pilot

This records the specific test environment. Do not copy its names, IDs or paths into
a general setup.

## Existing Google state

- Workspace account: `alejandro.acelas-contractor@80000hours.org`
- Cloud project: `agent-cli-tools-alejandro`
- Project number: `122477011422`
- Parent organization: `80000hours.org` (`883222343127`)
- Effective project role: `roles/owner`
- Enabled APIs confirmed: Docs and Drive
- Organization IAM and folder listing: denied

The Desktop OAuth JSON is stored outside the repository at:

```text
~/.config/credentials/google-oauth-client-agent-cli-tools-alejandro.json
```

The broker Web OAuth client ID and secret, token-encryption key and MCP client secret
are in the repository’s ignored `.env.local`, mode `600`. The Stripe Projects-managed
Upstash values remain in ignored `.env`; do not read or hand-edit `.env` or
`.projects/`. `secretspec.toml` declares the locally managed secret names without
values. `gcloud` stores its own signed-in CLI state under `~/.config/gcloud/`.

## Deployment and Claude

1. Authenticate `gcloud` with the Workspace account.
2. Confirm project parent, role and APIs with read-only `gcloud` commands.
3. Add the broker callback to the existing Google Web OAuth client.
4. Generate the broker encryption key and MCP client secret into `.env.local`.
5. Configure the temporary Vercel project from one `secretspec run` command.
6. Deploy the reviewed source with broker mode enabled.
7. In Claude organization settings, add a Custom Web connector with the MCP client
   credentials and Individual sign-in.
8. Connect the tester’s Workspace account.

The first endpoint was already present in Claude under an older connector record.
Claude does not edit custom connector records and rejects duplicate URLs. The pilot
therefore used a separate temporary project instead of deleting an organization
connector.

One provisional MCP client secret appeared in local automation output while testing
the duplicate form. It was rotated in `.env.local` and Vercel and the service was
redeployed before the successful connector was created.

## Live test

- Folder:
  [Temporary Docs MCP pilot — 2026-07-30](https://drive.google.com/drive/folders/1EK9uaoS9d1lLS-0d50ArOUX1zFk3ynM9)
- Document:
  [Temporary Docs MCP organization connector test — 2026-07-30](https://docs.google.com/document/d/1uUVSGAvTGIX1fbq7fAtABb99sINs7aGZYXgQSGF-C3k/edit)
- Claude conversation:
  `https://claude.ai/chat/794e694e-e81a-4005-bb61-5d5822fe791a`

Observed objects:

| Object | Evidence |
| --- | --- |
| Anchored comment | `AAACEgLGwDc`, anchor `The quick brown fox`, status `OPEN` |
| Reply | `AAACEgLGwDk`, present in the comment’s `replies` array |
| Suggestion | `suggest.sikujd78hn6n`, replacement of `PLUGH`, status `OPEN` |

The first read showed that `commentsViewMode` requires `includeTabsContent=true`.
The adapter now supplies that flag automatically. The MCP tool description now gives
the exact `insertComment.content` and `addCommentReply.post.content` shapes that the
model otherwise learned through retries.

## Checks

```sh
npm test
npm run check:docs
```

Open the test document and confirm the comment thread and the suggestion’s
Accept/Reject controls before recording a pass.
<!--/ai-->
