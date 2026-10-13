import type { Database } from "@/lib/db/client";

export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbClient = Database | DbTransaction;
