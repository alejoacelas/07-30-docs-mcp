# Bug report draft: Docs MCP omits preview comment and suggestion fields

## Summary

The Google Docs MCP connects successfully in Claude and supports ordinary `read_doc` and `update_doc` operations, but its exposed tool contract does not permit the Developer Preview comment and suggestion operations documented by Google.

## Environment

- MCP server: `https://docsmcp.googleapis.com/mcp/v1`
- Client: Claude custom connector
- Test date: 29 July 2026
- Workspace account and Cloud project are enrolled in the Google Workspace Developer Preview Program.

## Reproduction

1. Call `read_doc` on an editable Google Doc.
2. Call `update_doc` with:

   ```json
   {
     "documentId": "DOCUMENT_ID",
     "requests": [
       {
         "insertComment": {
           "content": "Test comment",
           "range": {
             "startIndex": 703,
             "endIndex": 721
           }
         }
       }
     ]
   }
   ```

3. Try an `insertText` request with the top-level control:

   ```json
   {
     "writeControl": {
       "writeMode": "SUGGEST"
     }
   }
   ```

## Observed

- The documented `insertComment.content` field appears to be stripped, and the request fails with `No request set`.
- The MCP tool schema exposed to Claude accepts only `documentId` and `requests`; it omits top-level `writeControl`.
- `read_doc` exposes only `documentId`; it cannot request `COMMENTS_VIEW_MODE_INCLUDED`.
- A direct unauthenticated JSON-RPC `tools/list` request to the hosted endpoint returns the same incomplete schema, so this is not a Claude schema-cache issue.

## Control

Using the same enrolled account, project, scopes, and document against the Docs REST API:

- `insertComment.content` created an anchored comment.
- `writeControl.writeMode: SUGGEST` created a suggested insertion.
- A preview-inclusive read returned the comment and suggestion.
- Both appeared in the Google Docs interface.

This rules out Developer Preview enrollment, OAuth scopes, and document permissions.

## Expected

- `insertComment.content` and `range` should reach `documents.batchUpdate`.
- `update_doc` should accept the documented `BatchUpdateDocumentRequest`, including `writeControl.writeMode: SUGGEST`.
- `read_doc` should support retrieving comments and suggestion threads, or the MCP documentation should state that it cannot.

## Impact

The connector appears healthy because reads and ordinary edits work, but users cannot use or verify the preview-only comments and suggestions advertised in the Docs MCP documentation. The Docs API itself works.

## Documentation

- [Docs MCP `update_doc`](https://developers.google.com/workspace/docs/api/reference/mcp/tools_list/update_doc)
- [InsertCommentRequest](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request)
- [Work with comments and suggestions](https://developers.google.com/workspace/docs/api/how-tos/suggestions)
