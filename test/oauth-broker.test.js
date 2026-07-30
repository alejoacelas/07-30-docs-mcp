import test from "node:test";
import assert from "node:assert/strict";

import { createOAuthBroker } from "../src/oauth-broker.js";
import { MemoryStore } from "../src/secure-store.js";
import { pkceChallenge, randomToken } from "../src/token-crypto.js";

const env = {
  DOCS_MCP_PUBLIC_ORIGIN: "https://mcp.example.org",
  DOCS_MCP_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64url"),
  GOOGLE_OAUTH_CLIENT_ID: "google-client",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
  MCP_OAUTH_CLIENT_ID: "claude-client",
  MCP_OAUTH_CLIENT_SECRET: "claude-secret",
  MCP_REDIRECT_URI: "https://claude.ai/api/mcp/auth_callback"
};

function basicAuth() {
  return `Basic ${Buffer.from("claude-client:claude-secret").toString("base64")}`;
}

test("broker publishes MCP-audience authorization metadata", () => {
  const broker = createOAuthBroker({ env, store: new MemoryStore() });
  assert.deepEqual(broker.protectedResourceMetadata(), {
    authorization_servers: ["https://mcp.example.org"],
    bearer_methods_supported: ["header"],
    resource: "https://mcp.example.org/mcp",
    scopes_supported: ["docs"]
  });
  const metadata = broker.authorizationServerMetadata();
  assert.equal(metadata.issuer, "https://mcp.example.org");
  assert.equal(
    metadata.authorization_endpoint,
    "https://mcp.example.org/oauth/authorize"
  );
  assert.deepEqual(metadata.code_challenge_methods_supported, ["S256"]);
});

test("authorization code flow separates MCP and Google tokens", async () => {
  const store = new MemoryStore();
  const googleRequests = [];
  const fetchImpl = async (url, options) => {
    googleRequests.push({ url, options });
    return new Response(
      JSON.stringify({
        access_token: "google-access",
        refresh_token: "google-refresh",
        expires_in: 3600
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  const broker = createOAuthBroker({ env, store, fetchImpl });
  const verifier = randomToken(48);
  const request = {
    response_type: "code",
    client_id: env.MCP_OAUTH_CLIENT_ID,
    redirect_uri: env.MCP_REDIRECT_URI,
    resource: "https://mcp.example.org/mcp",
    scope: "docs",
    state: "claude-state",
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256"
  };

  const page = broker.consentPage(request);
  const sealedRequest = page.match(/name="request" value="([^"]+)"/)?.[1];
  assert.ok(sealedRequest);

  const googleUrl = new URL(
    await broker.approveAuthorization({ request: sealedRequest })
  );
  assert.equal(googleUrl.origin, "https://accounts.google.com");
  assert.equal(googleUrl.searchParams.get("scope"), "https://www.googleapis.com/auth/documents");

  const callback = new URL(
    await broker.completeGoogle({
      state: googleUrl.searchParams.get("state"),
      code: "google-code"
    })
  );
  assert.equal(callback.origin, "https://claude.ai");
  assert.equal(callback.searchParams.get("state"), "claude-state");

  const code = callback.searchParams.get("code");
  const tokenResult = await broker.token(
    {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: env.MCP_REDIRECT_URI,
      resource: "https://mcp.example.org/mcp"
    },
    basicAuth()
  );
  assert.equal(tokenResult.status, 200);
  assert.notEqual(tokenResult.body.access_token, "google-access");
  assert.notEqual(tokenResult.body.refresh_token, "google-refresh");
  assert.equal(
    await broker.resolveAccess(`Bearer ${tokenResult.body.access_token}`),
    "Bearer google-access"
  );
  assert.equal(googleRequests[0].options.redirect, "error");

  const reused = await broker.token(
    {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: env.MCP_REDIRECT_URI,
      resource: "https://mcp.example.org/mcp"
    },
    basicAuth()
  );
  assert.equal(reused.body.error, "invalid_grant");

  await assert.rejects(
    broker.resolveAccess("Bearer google-access"),
    /Invalid or expired MCP access token/
  );

  for (const item of store.values.values()) {
    assert.doesNotMatch(item.value, /google-refresh/);
  }

  await broker.revoke(
    { token: tokenResult.body.refresh_token },
    basicAuth()
  );
  await assert.rejects(
    broker.resolveAccess(`Bearer ${tokenResult.body.access_token}`),
    /Google grant is unavailable/
  );
  assert.equal(
    googleRequests.at(-1).url,
    "https://oauth2.googleapis.com/revoke"
  );
});

test("refresh tokens rotate and remain audience-bound", async () => {
  const store = new MemoryStore();
  const broker = createOAuthBroker({
    env,
    store,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          access_token: "google-access",
          refresh_token: "google-refresh",
          expires_in: 3600
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  });
  const verifier = randomToken(48);
  const page = broker.consentPage({
    response_type: "code",
    client_id: env.MCP_OAUTH_CLIENT_ID,
    redirect_uri: env.MCP_REDIRECT_URI,
    resource: "https://mcp.example.org/mcp",
    state: "state",
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256"
  });
  const request = page.match(/name="request" value="([^"]+)"/)[1];
  const google = new URL(await broker.approveAuthorization({ request }));
  const callback = new URL(
    await broker.completeGoogle({
      state: google.searchParams.get("state"),
      code: "code"
    })
  );
  const first = await broker.token(
    {
      grant_type: "authorization_code",
      code: callback.searchParams.get("code"),
      code_verifier: verifier,
      redirect_uri: env.MCP_REDIRECT_URI,
      resource: "https://mcp.example.org/mcp"
    },
    basicAuth()
  );
  const second = await broker.token(
    {
      grant_type: "refresh_token",
      refresh_token: first.body.refresh_token,
      resource: "https://mcp.example.org/mcp"
    },
    basicAuth()
  );
  assert.equal(second.status, 200);
  assert.notEqual(second.body.refresh_token, first.body.refresh_token);

  const replay = await broker.token(
    {
      grant_type: "refresh_token",
      refresh_token: first.body.refresh_token,
      resource: "https://mcp.example.org/mcp"
    },
    basicAuth()
  );
  assert.equal(replay.body.error, "invalid_grant");

  const wrongAudience = await broker.token(
    {
      grant_type: "refresh_token",
      refresh_token: second.body.refresh_token,
      resource: "https://attacker.example/mcp"
    },
    basicAuth()
  );
  assert.equal(wrongAudience.body.error, "invalid_target");
});
