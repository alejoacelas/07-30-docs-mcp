<!--ai-->
# Self-hosted Google Docs MCP test

Tested 30 July 2026.

## Question

Can a small MCP adapter expose Google Docs Developer Preview operations that work through the REST API but are omitted or stripped by Google’s hosted MCP?

## Controlled setup

The hosted and self-hosted tests used the same:

- Google Workspace account
- Cloud project and OAuth client
- OAuth scopes
- Google document
- underlying `docs.googleapis.com` API
- Claude.ai custom-connector interface

Only the remote MCP endpoint changed.

## Adapter contract

The self-hosted MCP exposed:

- `read_doc` with `suggestionsViewMode`, `commentsViewMode`, and `includeTabsContent`
- `update_doc` with raw Docs API requests and top-level `writeControl`

It accepted Claude’s Google bearer token and forwarded it only to `https://docs.googleapis.com`.

## Test sequence

Claude was instructed to use only the self-hosted connector:

1. Read the document with suggestions inline, comments included, and tabs included.
2. Create a comment anchored to `COMMENT_ANCHOR_TWO`.
3. Reply to the new comment.
4. Append `CUSTOM_MCP_SUGGESTION_TEST` with `writeControl.writeMode: SUGGEST`.
5. Read the document again with preview objects included.

The first reply attempt placed `content` at the request’s top level and failed. Retrying with `post: {content: "…"}` matched the Docs API schema and succeeded.

## Result

- Anchored comment created: `AAAB_i_dd0k`
- Anchor: `kix.46y7dm7hovml`
- Comment range: indexes 774–792
- Comment update state: `ALL_SAVED`
- Reply created: `AAAB_i_dd0s`
- Open suggestion recovered: `suggest.htv9v1b7znya`
- Suggested paragraph: indexes 1115–1142
- Final read recovered the comment, nested reply, and suggested insertion.
- Google Docs displayed the anchored thread, reply, green suggested text, and suggestion card.

Google merged the new insertion into the existing open suggestion by the same author. The visible suggestion became `PREVIEW_SUGGESTION_TEST CUSTOM_MCP_SUGGESTION_TEST`.

## Conclusion

The Docs REST API and preview enrollment work. Google’s hosted MCP adapter is the failed component: it omits top-level `writeControl`, omits preview read parameters, and strips comment content. Preserving those fields in a self-hosted adapter makes the same operations pass through Claude.
<!--/ai-->
