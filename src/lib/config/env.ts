import { z } from "zod";

const postgresUrl = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    { error: "Expected a PostgreSQL connection string." },
  );

const optionalText = z.string().optional().or(z.literal(""));

const serverEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  SESSION_HASH_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(1),
  SMTP_HOST: optionalText,
  SMTP_PORT: optionalText,
  SMTP_USER: optionalText,
  SMTP_PASSWORD: optionalText,
  SMTP_FROM: optionalText,
  FILE_STORAGE_BASE_URL: optionalText,
  FILE_STORAGE_SECRET: optionalText,
  APP_ORIGIN: z.string().url().optional().or(z.literal("")),
  ENABLE_HSTS: z.enum(["true", "false"]).optional().or(z.literal("")),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvIssue = {
  ok: false;
  fields: string[];
};

export type EnvResult = { ok: true; env: ServerEnv } | EnvIssue;

export function parseServerEnv(source: NodeJS.ProcessEnv): EnvResult {
  const parsed = serverEnvSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    SESSION_HASH_SECRET: source.SESSION_HASH_SECRET,
    FIELD_ENCRYPTION_KEY: source.FIELD_ENCRYPTION_KEY,
    SMTP_HOST: emptyToUndefined(source.SMTP_HOST),
    SMTP_PORT: emptyToUndefined(source.SMTP_PORT),
    SMTP_USER: emptyToUndefined(source.SMTP_USER),
    SMTP_PASSWORD: emptyToUndefined(source.SMTP_PASSWORD),
    SMTP_FROM: emptyToUndefined(source.SMTP_FROM),
    FILE_STORAGE_BASE_URL: emptyToUndefined(source.FILE_STORAGE_BASE_URL),
    FILE_STORAGE_SECRET: emptyToUndefined(source.FILE_STORAGE_SECRET),
    APP_ORIGIN: source.APP_ORIGIN,
    ENABLE_HSTS: source.ENABLE_HSTS,
  });

  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "environment")),
    ];
    return { ok: false, fields };
  }

  const keyBytes = Buffer.from(parsed.data.FIELD_ENCRYPTION_KEY, "base64");
  if (keyBytes.length !== 32) {
    return { ok: false, fields: ["FIELD_ENCRYPTION_KEY"] };
  }

  if (parsed.data.FILE_STORAGE_BASE_URL && !isHttpsOrigin(parsed.data.FILE_STORAGE_BASE_URL)) {
    return { ok: false, fields: ["FILE_STORAGE_BASE_URL"] };
  }
  if (parsed.data.FILE_STORAGE_SECRET && parsed.data.FILE_STORAGE_SECRET.length < 32) {
    return { ok: false, fields: ["FILE_STORAGE_SECRET"] };
  }

  return { ok: true, env: parsed.data };
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached && process.env.NODE_ENV !== "development") {
    return cached;
  }
  const result = parseServerEnv(process.env);
  if (!result.ok) {
    throw new Error(`Missing or invalid server configuration: ${result.fields.join(", ")}`);
  }
  cached = result.env;
  return result.env;
}

export function resetServerEnvCache(): void {
  cached = undefined;
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.search === "" && url.hash === "";
  } catch {
    return false;
  }
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value;
}
