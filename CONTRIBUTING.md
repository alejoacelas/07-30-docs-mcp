# Contributing

## Before opening a change

1. Read [Design and security](docs/design-and-security.md).
2. Keep Google API origins fixed in source.
3. Do not add a Google scope without a concrete API call and documented reason.
4. Never record tokens, request headers, or document bodies.

## Test

```sh
npm ci
npm test
```

Add a regression test for every schema or authorization change.

## Documentation

- Keep the local, shared-remote, and self-hosted-remote trust boundaries distinct.
- Put failed experiments and detailed evidence under `docs/history/`.
- Reference only edited images under `docs/images/guide/`.
- Do not commit original screenshots, OAuth JSON, token files, or environment files.

## Commits

Keep structural moves, implementation changes, documentation rewrites, and image changes in separate commits so reviewers can inspect each layer.
