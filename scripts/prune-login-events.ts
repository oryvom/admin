import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db/client";
import { logSafeError } from "@/lib/security/log";

const retentionDays = 180;

async function main(): Promise<void> {
  if (!process.argv.includes("--confirm")) {
    process.stderr.write("Refusing to prune login events without --confirm.\n");
    process.exitCode = 1;
    return;
  }

  const db = getDb("admin");
  const result = await db.execute<{ count: number }>(
    sql`with removed as (
      delete from login_events
      where created_at < now() - (${retentionDays} * interval '1 day')
      returning 1
    )
    select count(*)::int as count from removed`,
  );
  process.stdout.write(`Removed login events older than ${retentionDays} days: ${result.rows[0]?.count ?? 0}.\n`);
}

main()
  .catch((error: unknown) => {
    logSafeError("login event prune failed", error);
    process.stderr.write("Login event prune failed.\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
