export function isSameOrigin(requestHeaders: Headers): boolean {
  const origin = requestHeaders.get("origin");
  if (!origin) {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const configured = process.env.APP_ORIGIN;
  if (configured) {
    try {
      return new URL(configured).origin === originUrl.origin;
    } catch {
      return false;
    }
  }

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    return false;
  }

  return originUrl.host === host;
}
