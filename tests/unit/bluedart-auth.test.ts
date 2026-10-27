import { describe, expect, it } from "vitest";
import { blueDartJwt, type BlueDartTokenStore, type StoredBlueDartToken } from "@/server/services/bluedart-auth";

const credentials = { consumerKey: "consumer-key", consumerSecret: "consumer-secret-value" };
const day = 23 * 60 * 60 * 1000;

describe("blue dart authentication", () => {
  it("reuses a token stored within 23 hours", async () => {
    let calls = 0;
    const store = memoryStore({ token: "stored-token", storedAt: Date.now() - day + 60_000 });
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ JWTToken: "new-token" }));
    };
    await expect(blueDartJwt(credentials, fetchImpl, store)).resolves.toBe("stored-token");
    expect(calls).toBe(0);
  });

  it("requests a new token after 23 hours and stores only the token", async () => {
    const store = memoryStore({ token: "stored-token", storedAt: Date.now() - day - 1 });
    const fetchImpl: typeof fetch = async (url, init) => {
      expect(String(url)).toBe("https://apigateway.bluedart.com/in/transportation/token/v1/login");
      const headers = new Headers(init?.headers);
      expect(headers.get("ClientID")).toBe(credentials.consumerKey);
      expect(headers.get("clientSecret")).toBe(credentials.consumerSecret);
      return new Response(JSON.stringify({ JWTToken: "new-token" }));
    };
    await expect(blueDartJwt(credentials, fetchImpl, store)).resolves.toBe("new-token");
    expect(store.record?.token).toBe("new-token");
    expect(JSON.stringify(store.record)).not.toContain(credentials.consumerSecret);
    expect(Date.now() - (store.record?.storedAt ?? 0)).toBeLessThan(5_000);
  });
});

function memoryStore(initial: StoredBlueDartToken | null = null): BlueDartTokenStore & { record: StoredBlueDartToken | null } {
  const box = { record: initial };
  return {
    get record() {
      return box.record;
    },
    read: () => box.record,
    write: (record) => {
      box.record = record;
    },
  };
}
