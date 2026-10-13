export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) {
    return 1;
  }
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
    return 1;
  }
  return page;
}

export function parseSearchQuery(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 100);
}
