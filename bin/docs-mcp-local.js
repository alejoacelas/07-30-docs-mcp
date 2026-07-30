#!/usr/bin/env node

import { createInterface } from "node:readline";

import { getAuthorization } from "../src/local-auth.js";
import { handleRpc } from "../src/mcp.js";

function errorResponse(id, message) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code: -32603, message }
  };
}

async function processMessage(message) {
  const authorization =
    message?.method === "tools/call" ? await getAuthorization() : undefined;
  return handleRpc(message, { authorization });
}

const lines = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false
});

for await (const line of lines) {
  if (!line.trim()) continue;
  let message;
  try {
    message = JSON.parse(line);
    const result = await processMessage(message);
    if (result.body !== null) {
      process.stdout.write(`${JSON.stringify(result.body)}\n`);
    }
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify(
        errorResponse(message?.id, error instanceof Error ? error.message : String(error))
      )}\n`
    );
  }
}
