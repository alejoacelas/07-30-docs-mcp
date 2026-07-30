#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { platform } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import { defaultTokenPath, writePrivateJson } from "../src/local-auth.js";
import { SCOPES } from "../src/mcp.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--client") args.client = argv[++index];
    else if (argv[index] === "--token") args.token = argv[++index];
    else if (argv[index] === "--no-open") args.noOpen = true;
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!args.client) {
    throw new Error("Usage: npm run auth -- --client /path/to/oauth-client.json");
  }
  return args;
}

function base64url(value) {
  return value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function openBrowser(url) {
  const command =
    platform() === "darwin"
      ? ["open", [url]]
      : platform() === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

async function exchangeCode({
  client,
  code,
  codeVerifier,
  redirectUri,
  fetchImpl = fetch
}) {
  const body = new URLSearchParams({
    client_id: client.client_id,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });
  if (client.client_secret) body.set("client_secret", client.client_secret);

  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  const token = await response.json();
  if (!response.ok || typeof token.refresh_token !== "string") {
    throw new Error(
      `Google OAuth exchange failed (${response.status}): ${
        token.error_description || token.error || "no refresh token returned"
      }`
    );
  }
  return token;
}

const args = parseArgs(process.argv.slice(2));
const credentialPath = resolve(args.client);
const tokenPath = resolve(args.token || defaultTokenPath());
const credentialJson = JSON.parse(await readFile(credentialPath, "utf8"));
const client = credentialJson.installed;

if (!client?.client_id) {
  throw new Error(
    "The OAuth JSON must contain an installed application client. Create a Desktop app OAuth client in Google Cloud."
  );
}

const state = base64url(randomBytes(32));
const codeVerifier = base64url(randomBytes(64));
const codeChallenge = base64url(
  createHash("sha256").update(codeVerifier).digest()
);

let timeout;
const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    if (requestUrl.pathname !== "/oauth/callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    if (requestUrl.searchParams.get("state") !== state) {
      response.writeHead(400).end("OAuth state mismatch");
      throw new Error("OAuth state mismatch");
    }
    const code = requestUrl.searchParams.get("code");
    if (!code) {
      throw new Error(
        requestUrl.searchParams.get("error_description") ||
          requestUrl.searchParams.get("error") ||
          "Google returned no authorization code"
      );
    }

    const redirectUri = `http://127.0.0.1:${server.address().port}/oauth/callback`;
    const token = await exchangeCode({
      client,
      code,
      codeVerifier,
      redirectUri
    });
    await writePrivateJson(tokenPath, {
      ...token,
      client_id: client.client_id,
      client_secret: client.client_secret,
      expires_at: Date.now() + Number(token.expires_in || 3600) * 1000
    });
    response.writeHead(200, {
      "content-type": "text/plain; charset=utf-8",
      connection: "close"
    });
    response.end(
      "Google Docs MCP authorization succeeded. You may close this tab.",
      () => {
        clearTimeout(timeout);
        server.closeAllConnections();
        server.close();
      }
    );
    console.log(`Authorization saved to ${tokenPath}`);
  } catch (error) {
    response.writeHead(500, {
      "content-type": "text/plain; charset=utf-8",
      connection: "close"
    });
    response.end("Authorization failed. Return to the terminal for details.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    clearTimeout(timeout);
    server.closeAllConnections();
    server.close();
  }
});

server.listen(0, "127.0.0.1", () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}/oauth/callback`;
  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );
  authorizationUrl.search = new URLSearchParams({
    access_type: "offline",
    client_id: client.client_id,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state
  });
  console.log("Authorize the local MCP in your browser:");
  console.log(authorizationUrl.toString());
  if (!args.noOpen) openBrowser(authorizationUrl.toString());
});

timeout = setTimeout(() => {
  console.error("Authorization timed out after five minutes.");
  server.closeAllConnections();
  server.close();
  process.exitCode = 1;
}, 5 * 60 * 1000);
