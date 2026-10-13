export const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;

export function accountLockoutMs(failureCount: number): number | null {
  if (failureCount < 5) {
    return null;
  }
  if (failureCount < 8) {
    return 60_000;
  }
  if (failureCount < 12) {
    return 5 * 60_000;
  }
  if (failureCount < 20) {
    return 15 * 60_000;
  }
  return 60 * 60_000;
}

export function ipLockoutMs(failureCount: number): number | null {
  if (failureCount < 30) {
    return null;
  }
  return 15 * 60_000;
}
