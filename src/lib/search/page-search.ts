export type SearchablePage = {
  href: string;
  title: string;
  terms: string[];
};

const minimumQueryLength = 3;
const minimumScore = 0.58;

export function searchPages(query: string, pages: SearchablePage[]): SearchablePage[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized.length < minimumQueryLength) {
    return [];
  }

  return pages
    .map((page) => ({ page, score: scorePage(normalized, page) }))
    .filter((item) => item.score >= minimumScore)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
    .map((item) => item.page);
}

function scorePage(query: string, page: SearchablePage): number {
  const candidates = [page.title, ...page.terms];
  return candidates.reduce((best, candidate) => Math.max(best, scoreText(query, candidate.toLowerCase())), 0);
}

function scoreText(query: string, text: string): number {
  const compact = text.replace(/[^a-z0-9]+/g, "");
  const words = text.split(/[^a-z0-9]+/).filter((word) => word.length > 0);
  return [text, compact, ...words].reduce((best, candidate) => Math.max(best, scorePair(query, candidate)), 0);
}

function scorePair(query: string, text: string): number {
  if (query.length === 0 || text.length === 0) {
    return 0;
  }
  if (text === query) {
    return 1;
  }
  if (text.startsWith(query)) {
    return 0.96;
  }
  if (text.includes(query)) {
    return 0.9;
  }

  let best = similarity(query, text);
  if (text.length > query.length) {
    best = Math.max(best, similarity(query, text.slice(0, query.length)));
    best = Math.max(best, similarity(query, text.slice(0, Math.min(text.length, query.length + 2))));
  }
  return best;
}

function similarity(left: string, right: string): number {
  const distance = levenshtein(left, right, 3);
  if (distance === null) {
    return 0;
  }
  return 1 - distance / Math.max(left.length, right.length);
}

function levenshtein(left: string, right: string, maxDistance: number): number | null {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return null;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowBest = current[0] ?? leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const inserted = (current[rightIndex - 1] ?? 0) + 1;
      const deleted = (previous[rightIndex] ?? 0) + 1;
      const replaced = (previous[rightIndex - 1] ?? 0) + cost;
      const next = Math.min(inserted, deleted, replaced);
      current[rightIndex] = next;
      rowBest = Math.min(rowBest, next);
    }
    if (rowBest > maxDistance) {
      return null;
    }
    previous = current;
  }

  const distance = previous[right.length] ?? maxDistance + 1;
  return distance > maxDistance ? null : distance;
}
