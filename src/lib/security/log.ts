export function logSafeError(message: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error(JSON.stringify({ message, name }));
}
