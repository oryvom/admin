import { readFileSync } from "node:fs";
import path from "node:path";

type Journal = {
  entries: { tag: string }[];
};

export function expectedMigrationCount(): number {
  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
  return journal.entries.length;
}
