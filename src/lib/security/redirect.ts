const BLOCKED_PREFIXES = ["/login", "/api"];

export function safeInternalPath(value: string | null | undefined): string {
  if (!value) {
    return "/dashboard";
  }

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("://") ||
    /[\u0000-\u001F]/.test(candidate)
  ) {
    return "/dashboard";
  }

  const path = candidate.split("?")[0] ?? candidate;
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return "/dashboard";
  }

  return candidate;
}
