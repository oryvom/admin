import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { getServerEnv } from "@/lib/config/env";
import * as officeTables from "@/lib/db/office-tables";
import * as schema from "@/lib/db/schema";

neonConfig.webSocketConstructor = ws;

const fullSchema = { ...schema, ...officeTables };

export type Database = NeonDatabase<typeof fullSchema>;

type PoolTarget = "app" | "admin";

const pools = new Map<PoolTarget, { pool: Pool; db: Database }>();

export function getDb(target: PoolTarget = "app"): Database {
  const existing = pools.get(target);
  if (existing) {
    return existing.db;
  }

  const env = getServerEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: target === "admin" ? 1 : 5 });
  const db = drizzle(pool, { schema: fullSchema });
  pools.set(target, { pool, db });
  return db;
}

export async function closeDb(): Promise<void> {
  const openPools = [...pools.values()];
  pools.clear();
  await Promise.all(openPools.map(async ({ pool }) => pool.end()));
}
