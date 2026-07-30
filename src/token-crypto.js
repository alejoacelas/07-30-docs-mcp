import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeKey(value) {
  if (!value) throw new Error("DOCS_MCP_TOKEN_KEY is required");
  const key = Buffer.from(value, "base64url");
  if (key.length !== 32) {
    throw new Error("DOCS_MCP_TOKEN_KEY must be 32 base64url-encoded bytes");
  }
  return key;
}

export function randomToken(bytes = 32) {
  return base64url(randomBytes(bytes));
}

export function tokenHash(token) {
  return createHash("sha256").update(token).digest("base64url");
}

export function pkceChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function constantTimeEqual(left, right) {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}

export function seal(value, keyValue, purpose) {
  const key = decodeKey(keyValue);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(purpose));
  const plaintext = Buffer.from(JSON.stringify(value));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [
    "v1",
    base64url(iv),
    base64url(cipher.getAuthTag()),
    base64url(ciphertext)
  ].join(".");
}

export function open(token, keyValue, purpose) {
  const [version, ivValue, tagValue, ciphertextValue, extra] =
    String(token).split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue || extra) {
    throw new Error("Invalid encrypted token");
  }
  const key = decodeKey(keyValue);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString("utf8"));
}
