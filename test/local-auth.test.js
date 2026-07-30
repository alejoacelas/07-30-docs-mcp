import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getAuthorization, writePrivateJson } from "../src/local-auth.js";

test("local auth returns an unexpired access token", async () => {
  const directory = await mkdtemp(join(tmpdir(), "docs-mcp-auth-"));
  const tokenPath = join(directory, "token.json");
  await writePrivateJson(tokenPath, {
    access_token: "local-test-token",
    client_id: "client",
    refresh_token: "refresh",
    expires_at: Date.now() + 3_600_000
  });

  assert.equal(
    await getAuthorization({ tokenPath }),
    "Bearer local-test-token"
  );
  assert.equal((await stat(tokenPath)).mode & 0o777, 0o600);
});

test("local auth refreshes and preserves the refresh token", async () => {
  const directory = await mkdtemp(join(tmpdir(), "docs-mcp-auth-"));
  const tokenPath = join(directory, "token.json");
  await writePrivateJson(tokenPath, {
    access_token: "expired",
    client_id: "client",
    client_secret: "secret",
    refresh_token: "refresh",
    expires_at: 1
  });
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(
      JSON.stringify({
        access_token: "refreshed",
        expires_in: 3600,
        token_type: "Bearer"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  assert.equal(
    await getAuthorization({ tokenPath, fetchImpl, now: 1000 }),
    "Bearer refreshed"
  );
  const stored = JSON.parse(await readFile(tokenPath, "utf8"));
  assert.equal(stored.refresh_token, "refresh");
  assert.equal(stored.access_token, "refreshed");
  assert.equal(request.url, "https://oauth2.googleapis.com/token");
  assert.match(String(request.options.body), /grant_type=refresh_token/);
});
