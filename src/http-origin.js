function firstHeader(value) {
  return String(value || "").split(",")[0].trim();
}

export function originFor(request, env = process.env) {
  const configured =
    env.DOCS_MCP_PUBLIC_ORIGIN ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  if (configured) {
    const url = new URL(configured);
    if (!["https:", "http:"].includes(url.protocol)) {
      throw new Error("DOCS_MCP_PUBLIC_ORIGIN must be an HTTP(S) origin");
    }
    return url.origin;
  }

  const proto = firstHeader(request.headers["x-forwarded-proto"]) || "https";
  const host =
    firstHeader(request.headers["x-forwarded-host"]) ||
    firstHeader(request.headers.host) ||
    "localhost:3000";
  if (!/^(https|http)$/.test(proto) || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    throw new Error("Invalid proxy origin headers");
  }
  return `${proto}://${host}`;
}
