export function sanitizeStorageLog(value: string, secret?: string): string {
  let cleaned = value.replace(/[^\n\x20-\x7E]/g, "").slice(-65536).trim();
  if (secret && secret.length > 0 && cleaned.includes(secret)) {
    cleaned = cleaned.split(secret).join("[redacted]");
  }
  return cleaned === "" ? "No storage errors have been recorded." : cleaned;
}
