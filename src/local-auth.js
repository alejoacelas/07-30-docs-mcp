import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EXPIRY_MARGIN_MS = 60_000;

export function defaultTokenPath(env = process.env) {
  return resolve(
    env.DOCS_MCP_TOKEN_FILE ||
      `${homedir()}/.config/google-docs-preview-mcp/token.json`
  );
}

async function readToken(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  for (const field of ["client_id", "refresh_token"]) {
    if (typeof parsed[field] !== "string" || !parsed[field]) {
      throw new Error(`Local OAuth token file is missing ${field}`);
    }
  }
  return parsed;
}

export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(dirname(path), 0o700);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600
  });
  await chmod(path, 0o600);
}

async function refreshToken(token, path, fetchImpl) {
  const body = new URLSearchParams({
    client_id: token.client_id,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });
  if (token.client_secret) body.set("client_secret", token.client_secret);

  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const value = await response.json();
  if (!response.ok || typeof value.access_token !== "string") {
    throw new Error(
      `Google OAuth refresh failed (${response.status}): ${
        value.error_description || value.error || "unknown error"
      }`
    );
  }

  const updated = {
    ...token,
    ...value,
    refresh_token: value.refresh_token || token.refresh_token,
    expires_at: Date.now() + Number(value.expires_in || 3600) * 1000
  };
  await writePrivateJson(path, updated);
  return updated;
}

export async function getAuthorization({
  tokenPath = defaultTokenPath(),
  fetchImpl = fetch,
  now = Date.now()
} = {}) {
  let token;
  try {
    token = await readToken(tokenPath);
  } catch (error) {
    throw new Error(
      `Local Google authorization is unavailable. Run \`npm run auth -- --client /path/to/oauth-client.json\`. ${error.message}`
    );
  }

  if (
    typeof token.access_token !== "string" ||
    !token.expires_at ||
    token.expires_at <= now + EXPIRY_MARGIN_MS
  ) {
    token = await refreshToken(token, tokenPath, fetchImpl);
  }
  return `Bearer ${token.access_token}`;
}
