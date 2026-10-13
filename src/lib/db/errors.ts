export function isUniqueViolation(error: unknown): boolean {
  return readCode(error) === "23505";
}

function readCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if ("cause" in error) {
    return readCode(error.cause);
  }
  return undefined;
}
