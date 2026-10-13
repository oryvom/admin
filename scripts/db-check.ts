import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/client";
import { expectedMigrationCount } from "@/lib/db/migrations";
import { logSafeError } from "@/lib/security/log";

async function main(): Promise<void> {
  const db = getDb("admin");
  await db.execute(sql`select 1 as ok`);
  const result = await db.execute<{ count: number }>(sql`select count(*)::int as count from drizzle.__drizzle_migrations`);
  const applied = result.rows[0]?.count ?? 0;
  const expected = expectedMigrationCount();
  process.stdout.write(`Database reachable. Applied migrations: ${applied}. Expected: ${expected}.\n`);
  if (applied < expected) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    logSafeError("database check failed", error);
    process.stderr.write("Database check failed. Confirm the Neon connection variables and migration state.\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
