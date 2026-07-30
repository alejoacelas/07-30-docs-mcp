# Screenshot editing method

The guide screenshots were edited with OpenAI’s built-in ImageGen tool on 30 July 2026.

## Selection

Only screenshots that answer a setup or verification question remain in the public guide:

- Docs API enabled
- OAuth branding
- Web-client callback
- Claude remote-connector form and connected state
- official MCP failure
- remote test result
- Google Docs visual result
- local Claude Desktop result

Redundant transitions, duplicate project pages, and prompts that are clearer as selectable text were removed.

## Edit rules

Each image-edit prompt required:

- preserve the source UI, typography, content, and layout;
- add thin high-contrast outlines;
- use small numbered badges outside the target control;
- keep leader lines away from text;
- blur only the exact account-, project-, document-, or object-specific string;
- leave labels and surrounding context readable;
- add no prose, crop, watermark, or unrelated change.

No screenshot visibly contained an OAuth client secret, access token, API key, or password. Redactions cover identifiers, not hidden credentials.

## Source handling

Unedited screenshots remain under `docs/images/originals/` locally and are ignored by Git. The public guide references only `docs/images/guide/`.

The current repository history still contains the original screenshots in earlier commits. Do not publish this history as a privacy-clean public repository. After review, create a sanitized public history containing only the final guide images.
