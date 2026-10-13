import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { INDIAN_STATES, isIndianStateCode } from "@/lib/company/india";
import { detectDocumentContent } from "@/lib/security/documents";
import { storageSignature } from "@/lib/security/storage-signature";
import { sanitizeStorageLog } from "@/lib/files/storage-log";
import { companyProfileSchema } from "@/lib/validation/company";
import { officeSchema } from "@/lib/validation/office";

describe("company administration", () => {
  it("stores only the current Indian state codes", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(isIndianStateCode("MH")).toBe(true);
    expect(isIndianStateCode("CT")).toBe(false);
    expect(new Set(INDIAN_STATES.map((state) => state.code)).size).toBe(36);
  });

  it("accepts statutory identifiers and a state code", () => {
    const parsed = companyProfileSchema.parse({
      companyName: "ORYVOM MOBILITY PRIVATE LIMITED",
      cin: "u12345mh2020ptc123456",
      pan: "abcde1234f",
      tan: "abcd12345e",
      addressLine1: "12 Example Road",
      city: "Mumbai",
      district: "Mumbai",
      stateCode: "MH",
      pinCode: "400001",
    });
    expect(parsed.cin).toBe("U12345MH2020PTC123456");
    expect(parsed.pan).toBe("ABCDE1234F");
    expect(parsed.tan).toBe("ABCD12345E");
    expect(parsed.stateCode).toBe("MH");
    expect(parsed.pinCode).toBe("400001");
    expect(companyProfileSchema.safeParse({ ...parsed, stateCode: "ZZ" }).success).toBe(false);
    expect(companyProfileSchema.safeParse({ ...parsed, pinCode: "012345" }).success).toBe(false);
  });

  it("keeps the storage log readable and removes a secret if one appears", () => {
    const secret = "test-storage-secret-with-32-characters";
    expect(sanitizeStorageLog(`2026-10-12T12:00:00Z store.php 401 signature_mismatch\n${secret}\n`, secret)).toBe(
      "2026-10-12T12:00:00Z store.php 401 signature_mismatch\n[redacted]",
    );
    expect(sanitizeStorageLog("   ")).toBe("No storage errors have been recorded.");
  });

  it("accepts an office GSTIN and rented property", () => {
    const parsed = officeSchema.parse({
      gstin: "27aapfu0939f1zv",
      addressLine1: "12 Example Road",
      city: "Mumbai",
      district: "Mumbai",
      stateCode: "MH",
      pinCode: "400001",
      propertyType: "rented",
    });
    expect(parsed.gstin).toBe("27AAPFU0939F1ZV");
    expect(officeSchema.safeParse({ ...parsed, propertyType: "owned" }).success).toBe(false);
  });

  it("recognizes pdf and image signatures", () => {
    expect(detectDocumentContent(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(detectDocumentContent(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectDocumentContent(Uint8Array.from([0x4d, 0x5a]))).toBeNull();
  });

  it("builds the file-vault signature the PHP endpoint verifies", () => {
    const secret = "test-storage-secret-with-32-characters";
    const signature = storageSignature({
      secret,
      timestamp: "1700000000",
      nonce: "nonce-value-123456",
      method: "post",
      path: "/store.php",
      contentSha256: createHash("sha256").update("").digest("hex"),
      storageKey: "",
    });
    expect(signature).toHaveLength(64);
    expect(signature).toBe(
      storageSignature({
        secret,
        timestamp: "1700000000",
        nonce: "nonce-value-123456",
        method: "POST",
        path: "/store.php",
        contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        storageKey: "",
      }),
    );
  });
});
