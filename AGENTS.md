<!--ai-->
# Google Docs Preview MCP

Read [README.md](README.md) before changing this project.

Use the Stripe Projects CLI to manage provisioned services and credentials. Do not
read or hand-edit `.projects/` or `.env`.

The production remote must not accept or forward Google API tokens as MCP bearer
tokens. Keep MCP and Google authorization separate, bind MCP tokens to the canonical
resource, and add a regression test for every authorization change.

Never log tokens, OAuth codes, request headers, or document bodies.
<!--/ai-->
