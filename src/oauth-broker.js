import {
  constantTimeEqual,
  open,
  pkceChallenge,
  randomToken,
  seal,
  tokenHash
} from "./token-crypto.js";

const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE = "https://oauth2.googleapis.com/revoke";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/documents";
const MCP_SCOPE = "docs";
const ACCESS_TTL = 10 * 60;
const CODE_TTL = 5 * 60;
const GOOGLE_STATE_TTL = 10 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;
const GRANT_TTL = REFRESH_TTL;

function required(env, name) {
  if (!env[name]) throw new Error(`${name} is required`);
  return env[name];
}

function normalizeOrigin(value) {
  return new URL(value).origin;
}

export function brokerConfig(env = process.env) {
  const origin = normalizeOrigin(required(env, "DOCS_MCP_PUBLIC_ORIGIN"));
  return {
    origin,
    issuer: origin,
    resource: `${origin}/mcp`,
    googleRedirectUri: `${origin}/oauth/google/callback`,
    googleClientId: required(env, "GOOGLE_OAUTH_CLIENT_ID"),
    googleClientSecret: required(env, "GOOGLE_OAUTH_CLIENT_SECRET"),
    mcpClientId: required(env, "MCP_OAUTH_CLIENT_ID"),
    mcpClientSecret: required(env, "MCP_OAUTH_CLIENT_SECRET"),
    mcpRedirectUri:
      env.MCP_REDIRECT_URI || "https://claude.ai/api/mcp/auth_callback",
    tokenKey: required(env, "DOCS_MCP_TOKEN_KEY")
  };
}

function parseForm(value) {
  if (!value) return {};
  if (typeof value === "string") return Object.fromEntries(new URLSearchParams(value));
  return value;
}

function oauthError(error, description, status = 400) {
  return { status, body: { error, error_description: description } };
}

function assertAuthorizationRequest(query, config, nowMs = Date.now()) {
  if (query.response_type !== "code") throw new Error("response_type must be code");
  if (query.client_id !== config.mcpClientId) throw new Error("Unknown client_id");
  if (query.redirect_uri !== config.mcpRedirectUri) {
    throw new Error("redirect_uri is not registered");
  }
  if (query.resource !== config.resource) throw new Error("Invalid MCP resource");
  if (query.code_challenge_method !== "S256" || !query.code_challenge) {
    throw new Error("PKCE S256 is required");
  }
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(query.code_challenge)) {
    throw new Error("Invalid PKCE challenge");
  }
  const scopes = String(query.scope || MCP_SCOPE).split(/\s+/).filter(Boolean);
  if (scopes.some((scope) => scope !== MCP_SCOPE)) {
    throw new Error("Unsupported scope");
  }
  if (!query.state) throw new Error("state is required");
  return {
    clientId: query.client_id,
    redirectUri: query.redirect_uri,
    resource: query.resource,
    scope: MCP_SCOPE,
    state: query.state,
    codeChallenge: query.code_challenge,
    expiresAt: nowMs + CODE_TTL * 1000
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseClient(header, form) {
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator >= 0) {
      return {
        id: decodeURIComponent(decoded.slice(0, separator)),
        secret: decodeURIComponent(decoded.slice(separator + 1))
      };
    }
  }
  return { id: form.client_id, secret: form.client_secret };
}

function assertClient(header, form, config) {
  const client = parseClient(header, form);
  if (
    !constantTimeEqual(client.id || "", config.mcpClientId) ||
    !constantTimeEqual(client.secret || "", config.mcpClientSecret)
  ) {
    throw new Error("Invalid client authentication");
  }
}

async function googleTokenRequest(body, config, fetchImpl) {
  const response = await fetchImpl(GOOGLE_TOKEN, {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const value = await response.json();
  if (!response.ok || !value.access_token) {
    throw new Error(
      `Google OAuth failed: ${value.error_description || value.error || response.status}`
    );
  }
  return value;
}

function accessKey(token) {
  return `oauth:access:${tokenHash(token)}`;
}

function refreshKey(token) {
  return `oauth:refresh:${tokenHash(token)}`;
}

function grantKey(id) {
  return `oauth:grant:${id}`;
}

function codeKey(code) {
  return `oauth:code:${tokenHash(code)}`;
}

function stateKey(state) {
  return `oauth:google-state:${tokenHash(state)}`;
}

export function createOAuthBroker({
  env = process.env,
  store,
  fetchImpl = fetch,
  now = () => Date.now()
}) {
  const config = brokerConfig(env);

  function authorizationServerMetadata() {
    return {
      issuer: config.issuer,
      authorization_endpoint: `${config.origin}/oauth/authorize`,
      token_endpoint: `${config.origin}/oauth/token`,
      revocation_endpoint: `${config.origin}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post"
      ],
      scopes_supported: [MCP_SCOPE]
    };
  }

  function protectedResourceMetadata() {
    return {
      authorization_servers: [config.issuer],
      bearer_methods_supported: ["header"],
      resource: config.resource,
      scopes_supported: [MCP_SCOPE]
    };
  }

  function consentPage(query) {
    const request = assertAuthorizationRequest(query, config, now());
    const sealed = seal(request, config.tokenKey, "authorization-request");
    return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Authorize Google Docs Preview MCP</title>
<main style="max-width:42rem;margin:10vh auto;font:16px system-ui;line-height:1.5;padding:1rem">
  <h1>Authorize Google Docs Preview MCP</h1>
  <p>Continue to Google to let this organization-operated MCP read and edit Google Docs on your behalf.</p>
  <p>Claude receives an MCP-specific token. Google tokens are encrypted and kept by the organization-operated service.</p>
  <form method="post" action="/oauth/authorize">
    <input type="hidden" name="request" value="${escapeHtml(sealed)}">
    <button type="submit">Continue to Google</button>
  </form>
</main>`;
  }

  async function approveAuthorization(body) {
    const form = parseForm(body);
    const request = open(
      form.request,
      config.tokenKey,
      "authorization-request"
    );
    if (request.expiresAt <= now()) throw new Error("Authorization request expired");
    assertAuthorizationRequest(
      {
        response_type: "code",
        client_id: request.clientId,
        redirect_uri: request.redirectUri,
        resource: request.resource,
        scope: request.scope,
        state: request.state,
        code_challenge: request.codeChallenge,
        code_challenge_method: "S256"
      },
      config,
      now()
    );

    const googleState = randomToken();
    const googleVerifier = randomToken(64);
    const transaction = seal(
      { ...request, googleVerifier },
      config.tokenKey,
      "google-transaction"
    );
    if (
      !(await store.set(
        stateKey(googleState),
        transaction,
        GOOGLE_STATE_TTL,
        { nx: true }
      ))
    ) {
      throw new Error("Could not create authorization transaction");
    }

    const url = new URL(GOOGLE_AUTHORIZE);
    url.search = new URLSearchParams({
      access_type: "offline",
      client_id: config.googleClientId,
      code_challenge: pkceChallenge(googleVerifier),
      code_challenge_method: "S256",
      prompt: "consent",
      redirect_uri: config.googleRedirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPE,
      state: googleState
    });
    return url.toString();
  }

  async function completeGoogle(query) {
    if (!query.state || !query.code) throw new Error("Google returned no code");
    const encrypted = await store.getdel(stateKey(query.state));
    if (!encrypted) throw new Error("Invalid or reused Google state");
    const transaction = open(
      encrypted,
      config.tokenKey,
      "google-transaction"
    );
    if (transaction.expiresAt <= now()) throw new Error("Authorization expired");

    const google = await googleTokenRequest(
      new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        code: query.code,
        code_verifier: transaction.googleVerifier,
        grant_type: "authorization_code",
        redirect_uri: config.googleRedirectUri
      }),
      config,
      fetchImpl
    );
    if (!google.refresh_token) {
      throw new Error("Google returned no refresh token");
    }

    const grantId = randomToken();
    const grant = seal(
      {
        accessToken: google.access_token,
        refreshToken: google.refresh_token,
        expiresAt: now() + Number(google.expires_in || 3600) * 1000
      },
      config.tokenKey,
      "google-grant"
    );
    await store.set(grantKey(grantId), grant, GRANT_TTL);

    const code = randomToken();
    const codeRecord = seal(
      {
        clientId: transaction.clientId,
        redirectUri: transaction.redirectUri,
        resource: transaction.resource,
        scope: transaction.scope,
        codeChallenge: transaction.codeChallenge,
        grantId,
        expiresAt: now() + CODE_TTL * 1000
      },
      config.tokenKey,
      "authorization-code"
    );
    await store.set(codeKey(code), codeRecord, CODE_TTL, { nx: true });

    const redirect = new URL(transaction.redirectUri);
    redirect.searchParams.set("code", code);
    redirect.searchParams.set("state", transaction.state);
    return redirect.toString();
  }

  async function issueTokens(record) {
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const accessRecord = {
      grantId: record.grantId,
      clientId: record.clientId,
      resource: record.resource,
      scope: record.scope,
      expiresAt: now() + ACCESS_TTL * 1000
    };
    const refreshRecord = {
      ...accessRecord,
      expiresAt: now() + REFRESH_TTL * 1000
    };
    await Promise.all([
      store.set(accessKey(accessToken), JSON.stringify(accessRecord), ACCESS_TTL),
      store.set(
        refreshKey(refreshToken),
        seal(refreshRecord, config.tokenKey, "refresh-record"),
        REFRESH_TTL
      )
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL,
      refresh_token: refreshToken,
      scope: record.scope
    };
  }

  async function token(body, authorizationHeader) {
    const form = parseForm(body);
    try {
      assertClient(authorizationHeader, form, config);
      if (form.resource !== config.resource) {
        return oauthError("invalid_target", "Invalid MCP resource");
      }

      if (form.grant_type === "authorization_code") {
        if (form.redirect_uri !== config.mcpRedirectUri) {
          return oauthError("invalid_grant", "redirect_uri does not match");
        }
        const encrypted = await store.getdel(codeKey(form.code || ""));
        if (!encrypted) {
          return oauthError("invalid_grant", "Invalid or reused authorization code");
        }
        const record = open(
          encrypted,
          config.tokenKey,
          "authorization-code"
        );
        if (
          record.expiresAt <= now() ||
          !constantTimeEqual(
            pkceChallenge(form.code_verifier || ""),
            record.codeChallenge
          )
        ) {
          return oauthError("invalid_grant", "Authorization code validation failed");
        }
        return { status: 200, body: await issueTokens(record) };
      }

      if (form.grant_type === "refresh_token") {
        const encrypted = await store.getdel(refreshKey(form.refresh_token || ""));
        if (!encrypted) {
          return oauthError("invalid_grant", "Invalid or reused refresh token");
        }
        const record = open(encrypted, config.tokenKey, "refresh-record");
        if (
          record.expiresAt <= now() ||
          record.clientId !== config.mcpClientId ||
          record.resource !== config.resource
        ) {
          return oauthError("invalid_grant", "Refresh token validation failed");
        }
        return { status: 200, body: await issueTokens(record) };
      }
      return oauthError("unsupported_grant_type", "Unsupported grant_type");
    } catch (error) {
      return oauthError("invalid_client", error.message, 401);
    }
  }

  async function resolveAccess(authorizationHeader) {
    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new Error("MCP bearer token required");
    }
    const token = authorizationHeader.slice(7);
    const raw = await store.get(accessKey(token));
    if (!raw) throw new Error("Invalid or expired MCP access token");
    const access = JSON.parse(raw);
    if (
      access.expiresAt <= now() ||
      access.clientId !== config.mcpClientId ||
      access.resource !== config.resource
    ) {
      throw new Error("MCP access token validation failed");
    }

    const encrypted = await store.get(grantKey(access.grantId));
    if (!encrypted) throw new Error("Google grant is unavailable");
    let grant = open(encrypted, config.tokenKey, "google-grant");
    if (grant.expiresAt <= now() + 60_000) {
      const refreshed = await googleTokenRequest(
        new URLSearchParams({
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          grant_type: "refresh_token",
          refresh_token: grant.refreshToken
        }),
        config,
        fetchImpl
      );
      grant = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || grant.refreshToken,
        expiresAt: now() + Number(refreshed.expires_in || 3600) * 1000
      };
      await store.set(
        grantKey(access.grantId),
        seal(grant, config.tokenKey, "google-grant"),
        GRANT_TTL
      );
    }
    return `Bearer ${grant.accessToken}`;
  }

  async function revoke(body, authorizationHeader) {
    const form = parseForm(body);
    assertClient(authorizationHeader, form, config);
    const token = form.token || "";
    const refresh = await store.getdel(refreshKey(token));
    await store.del(accessKey(token));
    if (refresh) {
      const record = open(refresh, config.tokenKey, "refresh-record");
      const encrypted = await store.get(grantKey(record.grantId));
      try {
        if (encrypted) {
          const grant = open(encrypted, config.tokenKey, "google-grant");
          await fetchImpl(GOOGLE_REVOKE, {
            method: "POST",
            redirect: "error",
            headers: {
              "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ token: grant.refreshToken })
          });
        }
      } finally {
        await store.del(grantKey(record.grantId));
      }
    }
    return { status: 200, body: {} };
  }

  return {
    authorizationServerMetadata,
    protectedResourceMetadata,
    consentPage,
    approveAuthorization,
    completeGoogle,
    token,
    resolveAccess,
    revoke,
    config
  };
}
