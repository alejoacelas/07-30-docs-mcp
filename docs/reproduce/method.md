# Method

1. Reproduced the official Google Docs MCP schema omissions in Claude and by calling
   its `tools/list` endpoint.
2. Proved that the underlying Developer Preview Docs API accepts anchored comments,
   comment replies and `writeControl.writeMode: SUGGEST`.
3. Built a two-tool MCP that forwards the complete Preview request and response
   schema to the fixed `docs.googleapis.com` origin.
4. Added local OAuth and stdio transport; tested Claude Code and Claude Desktop.
5. Replaced remote Google-token passthrough with a broker that issues separate,
   resource-bound MCP tokens and stores encrypted Google grants.
6. Documented the Google Workspace, Cloud, hosting and Claude approval boundaries.
7. Confirmed the existing Preview project is inside the 80,000 Hours Cloud
   organization and that the tester has Project Owner access.
8. Deployed an isolated temporary broker, published it as a Claude organization
   connector and completed individual Google sign-in.
9. Ran a disposable-document test from Claude.ai and recovered the anchored comment,
   reply and unresolved suggestion through a final Preview API read.
10. Opened the document in Google Docs and visually confirmed the comment thread and
    suggestion controls.
11. Added the exact request shapes and automatic tab-content flag that the live test
    showed were needed for a smoother model workflow.

Secrets remain only in ignored mode-`600` local files and provider secret stores.
The [organization pilot record](organization-connector-pilot.md) gives the exact
credential locations and test evidence without publishing values.
