const SENSITIVE_KEY = /password|token|secret|cookie|authorization|hash|recovery|session/i;

export type AuditMetadata = Record<string, string | number | boolean | null>;

export function sanitizeAuditMetadata(input: Record<string, unknown>): AuditMetadata {
  const metadata: AuditMetadata = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }
    if (typeof value === "string") {
      metadata[key] = value.slice(0, 200);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      metadata[key] = value;
    }
  }
  return metadata;
}
