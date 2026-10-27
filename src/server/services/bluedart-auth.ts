import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";

const tokenUrl = "https://apigateway.bluedart.com/in/transportation/token/v1/login";
const tokenLifetimeMs = 23 * 60 * 60 * 1000;
const tokenDirectory = path.join(process.cwd(), ".data");
const tokenFile = path.join(tokenDirectory, "bluedart-token.json");

export type StoredBlueDartToken = {
  token: string;
  storedAt: number;
};

export type BlueDartTokenStore = {
  read: () => Promise<StoredBlueDartToken | null> | StoredBlueDartToken | null;
  write: (record: StoredBlueDartToken) => Promise<void> | void;
};

export async function blueDartJwt(
  credentials: { consumerKey: string; consumerSecret: string },
  fetchImpl?: typeof fetch,
  store: BlueDartTokenStore = fetchImpl ? emptyStore() : fileStore(),
): Promise<string | null> {
  const stored = await store.read();
  if (stored && Date.now() - stored.storedAt < tokenLifetimeMs && isJwt(stored.token)) {
    logToken({ generated: true, source: "stored", tokenLength: stored.token.length });
    return stored.token;
  }
  const body = await getToken(tokenUrl, fetchImpl, {
    ClientID: credentials.consumerKey,
    clientSecret: credentials.consumerSecret,
  });
  const token = readJwt(body);
  logToken({ generated: Boolean(token), source: token ? "new" : "rejected", tokenLength: token?.length ?? 0 });
  if (!token) {
    return null;
  }
  await store.write({ token, storedAt: Date.now() });
  return token;
}

function logToken(entry: { generated: boolean; source: "stored" | "new" | "rejected"; tokenLength: number }): void {
  console.info(JSON.stringify({ message: "blue dart token", ...entry }));
}

function emptyStore(): BlueDartTokenStore {
  return {
    read: () => null,
    write: () => undefined,
  };
}

function fileStore(): BlueDartTokenStore {
  return {
    async read() {
      try {
        const json = JSON.parse(await readFile(tokenFile, "utf8")) as { token?: unknown; storedAt?: unknown };
        if (typeof json.token !== "string" || typeof json.storedAt !== "number" || !isJwt(json.token)) {
          return null;
        }
        return { token: json.token, storedAt: json.storedAt };
      } catch {
        return null;
      }
    },
    async write(record) {
      await mkdir(tokenDirectory, { recursive: true, mode: 0o700 });
      const temporary = `${tokenFile}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ token: record.token, storedAt: record.storedAt }), { mode: 0o600 });
      await rename(temporary, tokenFile);
      await chmod(tokenFile, 0o600);
    },
  };
}

function readJwt(body: string): string | null {
  try {
    const json = JSON.parse(body) as { JWTToken?: unknown };
    return typeof json.JWTToken === "string" && isJwt(json.JWTToken) ? json.JWTToken.trim() : null;
  } catch {
    return null;
  }
}

function isJwt(value: string): boolean {
  const token = value.trim();
  return token.length > 0 && token.length <= 8000 && /^[\w.~+/-]+=*$/.test(token);
}

function getToken(url: string, fetchImpl: typeof fetch | undefined, headers: Record<string, string>): Promise<string> {
  if (fetchImpl) {
    return fetchImpl(url, { method: "GET", headers, redirect: "error" }).then((response) => response.text());
  }
  const target = new URL(url);
  if (target.protocol !== "https:" || target.hostname !== "apigateway.bluedart.com" || target.pathname !== "/in/transportation/token/v1/login") {
    return Promise.reject(new Error("Blue Dart address is not allowed."));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, text?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      resolve(text ?? "");
    };
    const request = https.request(
      {
        hostname: target.hostname,
        path: target.pathname,
        method: "GET",
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 100_000) {
            response.destroy();
            finish(new Error("Blue Dart response was too large."));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => finish(undefined, Buffer.concat(chunks).toString("utf8")));
        response.on("error", (error) => finish(error));
      },
    );
    request.setTimeout(20_000, () => {
      const error = new Error("timeout");
      error.name = "TimeoutError";
      request.destroy(error);
      finish(error);
    });
    request.on("error", (error) => finish(error));
    request.end();
  });
}
