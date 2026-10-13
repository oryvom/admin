import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  // Generation does not need a live database. Migrate fails later if the URL is absent.
}

const url = process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder";

export default defineConfig({
  schema: ["./src/lib/db/schema.ts", "./src/lib/db/office-tables.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
