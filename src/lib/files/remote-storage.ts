import { createHash, randomBytes } from "node:crypto";
import { getServerEnv, type ServerEnv } from "@/lib/config/env";
import type { DocumentContentType } from "@/lib/security/documents";
import { storageSignature } from "@/lib/security/storage-signature";

export type StoredFile = {
  storageKey: string;
  sha256: string;
  contentType: DocumentContentType;
  byteSize: number;
};

type StorageSettings = {
  baseUrl: string;
  secret: string;
};

export class StorageHostError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("File storage rejected the upload.");
    this.name = "StorageHostError";
    this.status = status;
  }
}

export function readStorageSettings(env: ServerEnv): StorageSettings | null {
  const baseUrl = env.FILE_STORAGE_BASE_URL?.replace(/\/$/, "");
  const secret = env.FILE_STORAGE_SECRET;
  if (!baseUrl || !secret || secret.length < 32 || secret.startsWith("replace-with")) {
    return null;
  }
  return { baseUrl, secret };
}

export async function storeRemoteFile(bytes: Buffer, contentType: DocumentContentType): Promise<StoredFile> {
  const settings = requiredSettings();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const payload = await signedRequest(settings, "/store.php", bytes, sha256, "");
  const storageKey = readStorageKey(payload);
  return { storageKey, sha256, contentType, byteSize: bytes.length };
}

export async function fetchRemoteFile(storageKey: string): Promise<{ bytes: Buffer; sha256: string; contentType: string }> {
  const settings = requiredSettings();
  const response = await signedFetch(settings, "/fetch.php", Buffer.alloc(0), emptySha256(), storageKey);
  if (!response.ok) {
    throw new Error("File storage could not return the document.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const declared = response.headers.get("x-oryvom-content-sha256");
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!declared || declared !== sha256 || !isAllowedContentType(contentType)) {
    throw new Error("File storage returned an unexpected document.");
  }
  return { bytes, sha256, contentType };
}

export async function removeRemoteFile(storageKey: string): Promise<void> {
  const settings = requiredSettings();
  const response = await signedFetch(settings, "/remove.php", Buffer.alloc(0), emptySha256(), storageKey);
  if (!response.ok) {
    throw new Error("File storage could not remove the document.");
  }
}

export async function readRemoteLog(): Promise<string> {
  const settings = requiredSettings();
  const response = await signedFetch(settings, "/log.php", Buffer.alloc(0), emptySha256(), "");
  if (!response.ok) {
    throw new StorageHostError(response.status);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (contentType !== "text/plain") {
    throw new Error("File storage could not return the log.");
  }
  return response.text();
}

function requiredSettings(): StorageSettings {
  const settings = readStorageSettings(getServerEnv());
  if (!settings) {
    throw new Error("File storage is not configured.");
  }
  return settings;
}

async function signedRequest(settings: StorageSettings, path: string, body: Buffer, sha256: string, storageKey: string): Promise<unknown> {
  const response = await signedFetch(settings, path, body, sha256, storageKey);
  if (!response.ok) {
    throw new StorageHostError(response.status);
  }
  return response.json() as Promise<unknown>;
}

async function signedFetch(
  settings: StorageSettings,
  path: string,
  body: Buffer,
  sha256: string,
  storageKey: string,
): Promise<Response> {
  const direct = await postSigned(settings, path, path, body, sha256, storageKey);
  if (direct.status !== 404) {
    return direct;
  }
  return postSigned(settings, `/public_html${path}`, path, body, sha256, storageKey);
}

async function postSigned(
  settings: StorageSettings,
  urlPath: string,
  signaturePath: string,
  body: Buffer,
  sha256: string,
  storageKey: string,
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("base64url");
  const signature = storageSignature({
    secret: settings.secret,
    timestamp,
    nonce,
    method: "POST",
    path: signaturePath,
    contentSha256: sha256,
    storageKey,
  });
  return fetch(new URL(urlPath, settings.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-oryvom-timestamp": timestamp,
      "x-oryvom-nonce": nonce,
      "x-oryvom-content-sha256": sha256,
      "x-oryvom-storage-key": storageKey,
      "x-oryvom-signature": signature,
    },
    body: new Uint8Array(body),
    cache: "no-store",
  });
}

function readStorageKey(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("storageKey" in payload)) {
    throw new Error("File storage rejected the upload.");
  }
  const storageKey = payload.storageKey;
  if (typeof storageKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageKey)) {
    throw new Error("File storage rejected the upload.");
  }
  return storageKey;
}

function emptySha256(): string {
  return createHash("sha256").update(Buffer.alloc(0)).digest("hex");
}

function isAllowedContentType(value: string): boolean {
  return value === "application/pdf" || value === "image/jpeg" || value === "image/png";
}
