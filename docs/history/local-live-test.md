# Local live test

Tested 30 July 2026 against a disposable Google Doc.

## Method

The local installed-app OAuth token and the same `readDocument` and `updateDocument` functions used by the stdio MCP performed:

1. a preview-inclusive read;
2. an anchored `insertComment`;
3. an `addCommentReply` with `post.content`;
4. an `insertText` batch with top-level `writeControl.writeMode: SUGGEST`;
5. a second preview-inclusive read.

The test printed IDs only to the local terminal. They are omitted here.

## Result

- The comment persisted.
- The reply persisted.
- The suggested insertion persisted as an open suggestion.
- `commentUpdateState` was `ALL_SAVED`.
- The final read returned a comment ID, reply post ID, and suggestion ID.

Claude Desktop separately used `google-docs-preview-local` to recover the document’s comment and suggestion threads. A later multi-write Claude turn stalled in Claude’s approval UI after it was interrupted; the same writes passed through the local implementation directly.

## Error isolated during the test

An earlier prompt used `replyComment`, which Google rejected as an unknown request. The current Developer Preview schema calls the operation `addCommentReply`. Its content belongs at `addCommentReply.post.content`.

This distinction is covered by the current verification prompt and regression documentation.
