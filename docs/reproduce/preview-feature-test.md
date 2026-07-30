# Developer Preview feature test

Date: 29 July 2026

## Question

Does the connected Google Docs MCP in Claude expose the Developer Preview functionality for creating anchored comments and suggested edits?

## Test document

Private disposable Google Doc titled “MCP Edit & Comment Test — Placeholder.” The document ID is omitted from the public guide.

## Method

Claude was instructed to use only the connected Google Docs MCP:

1. Read the document.
2. Add an anchored comment with `insertComment`.
3. Append `PREVIEW_SUGGESTION_TEST` using `writeControl.writeMode: SUGGEST`.
4. Read the document again and report the exact responses.
5. Stop instead of substituting direct edits when a preview field was rejected.

Each write received one-time approval. The connector was not granted permanent approval.

## Results

### Hosted MCP

- `read_doc` succeeded.
- `insertComment` with `text` returned: `Cannot find field: text in message google.apps.docs.v1.InsertCommentRequest`.
- `insertComment` with the documented `content` field failed because the field was stripped, leaving no usable request.
- Claude reported that its `update_doc` schema exposed only `documentId` and `requests`, not the top-level `writeControl` field required for suggest mode.
- A non-mutating probe carrying `writeControl.writeMode: SUGGEST` failed during tool execution.
- An independent JSON-RPC `tools/list` request to `https://docsmcp.googleapis.com/mcp/v1` returned the same two-field `update_doc` schema. The omission originates at Google’s hosted MCP endpoint rather than Claude.
- The final read returned the same revision ID and contained no suggested insertion IDs.
- The Google Docs comments panel contained no comments.
- Find and replace returned `0 of 0` for `PREVIEW_SUGGESTION_TEST`.

No comment, suggestion, named range, or direct text edit was created during this test.

### Underlying Docs API control

The same Workspace account, Cloud project, OAuth scopes, and document were tested through `https://docs.googleapis.com/v1/documents`:

- A preview-inclusive read succeeded.
- `insertComment.content` created open comment `AAACEf2ags8`, anchored to the exact text `COMMENT_ANCHOR_ONE`.
- A batch update with `writeControl.writeMode: SUGGEST` created suggested insertion `suggest.htv9v1b7znya`.
- A second preview-inclusive read returned both objects.
- Google Docs displayed the comment and suggestion.

## Interpretation

The account and project have working Developer Preview access. Google’s hosted Docs MCP adapter does not currently expose the complete preview comment/suggestion schema documented by Google.

This distinguishes three states:

1. **Not connected:** `read_doc` and `update_doc` are unavailable.
2. **Connected:** ordinary reads and direct edits work.
3. **Full preview surface available through the Docs API:** anchored comments and suggest-mode writes succeed.

This setup is in state 2 through the hosted MCP and state 3 through the underlying Docs API.

## Sources

- [Work with comments and suggestions](https://developers.google.com/workspace/docs/api/how-tos/suggestions)
- [Docs MCP `update_doc` reference](https://developers.google.com/workspace/docs/api/reference/mcp/tools_list/update_doc)
- [Docs API release notes](https://developers.google.com/workspace/docs/release-notes)
