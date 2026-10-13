import { createHmac } from "node:crypto";

export function storageSignature(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  contentSha256: string;
  storageKey: string;
}): string {
  const payload = [
    "v1",
    input.timestamp,
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    input.contentSha256,
    input.storageKey,
  ].join("\n");
  return createHmac("sha256", input.secret).update(payload).digest("hex");
}
