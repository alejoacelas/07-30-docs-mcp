# Method

1. Read Google’s Docs MCP configuration guide.
2. Searched Gmail for the Developer Preview confirmation and project number.
3. Matched the project number to its project ID in Google Cloud Console.
4. Verified the Google Docs API and enabled the Docs MCP API.
5. Added and saved the four scopes specified by Google.
6. Created a Claude-specific web OAuth client with Claude’s callback URI.
7. Added the remote MCP server to Claude and completed Google OAuth.
8. Refreshed the connector and verified that Claude exposed `read_doc` and `update_doc`.
9. Reworked the guide so project names, project identifiers, account details, and organization details are examples rather than instructions.
10. Added the general project-creation and Developer Preview application path using a second test project.
11. Removed desktop OAuth credentials from the guide after confirming that the preview form needs only a project number and that Claude uses a web OAuth client created later.
12. Ran a preview-only test for anchored comments and suggest-mode writes through Claude’s connected Docs MCP.
13. Verified the unchanged document independently in Google Docs using the comments panel and Find and replace.
14. Confirmed from Google’s approval email that the tested Workspace account and project number were enrolled.
15. Called the hosted MCP endpoint’s `tools/list` method directly and reproduced Claude’s incomplete schema.
16. Repeated the two preview writes against the underlying Docs REST API with the same account and document.
17. Verified the returned comment and suggestion IDs through a second API read.
18. Reloaded the document and captured the anchored comment and suggested insertion in Google Docs.

OAuth credentials were held only in memory long enough to transfer them from Google Cloud Console to Claude. The secret was not saved to disk or captured in a screenshot.
