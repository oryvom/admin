export function buildContentSecurityPolicy(options: {
  nonce: string;
  isDevelopment: boolean;
  upgradeInsecureRequests: boolean;
}): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${options.nonce}'`,
    "'strict-dynamic'",
    options.isDevelopment ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    options.upgradeInsecureRequests ? "upgrade-insecure-requests" : "",
  ];

  return directives.filter(Boolean).join("; ");
}
