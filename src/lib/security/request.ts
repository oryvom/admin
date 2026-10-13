export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
};

export function readRequestContext(requestHeaders: Headers): RequestContext {
  const forwarded = requestHeaders.get("x-forwarded-for");
  const firstHop = forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "";
  const ipAddress = isSafeIp(firstHop) ? firstHop : null;
  const userAgentRaw = requestHeaders.get("user-agent");
  const requestIdHeader = requestHeaders.get("x-request-id");

  return {
    ipAddress,
    userAgent: userAgentRaw ? userAgentRaw.slice(0, 512) : null,
    requestId: requestIdHeader && isRequestId(requestIdHeader) ? requestIdHeader : crypto.randomUUID(),
  };
}

function isSafeIp(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[a-fA-F0-9:.]+$/.test(value);
}

function isRequestId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}
