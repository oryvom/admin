import https from "node:https";
import { logSafeError } from "@/lib/security/log";
import {
  blueDartFinderUrl,
  blueDartRateAction,
  blueDartTransitAction,
  concealSecrets,
  readShipmentCostXml,
  readTransitTimeXml,
  shipmentCostEnvelope,
  transitTimeEnvelope,
  type BlueDartSettings,
  type ShipmentCost,
  type ShipmentCostInput,
  type TransitTimeInput,
  type TransitTimeQuote,
} from "@/lib/shipping/transit-time";

export type TransitTimeResult = { ok: true; quote: TransitTimeQuote } | { ok: false; message: string };
export type ShipmentCostResult = { ok: true; cost: ShipmentCost } | { ok: false; message: string };

export async function requestShipmentCost(
  settings: BlueDartSettings,
  input: ShipmentCostInput,
  fetchImpl?: typeof fetch,
): Promise<ShipmentCostResult> {
  try {
    const xml = await postBlueDart(blueDartFinderUrl, blueDartRateAction, shipmentCostEnvelope(input, settings), fetchImpl);
    const cost = readShipmentCostXml(xml);
    if (!cost) {
      return { ok: false, message: "Blue Dart did not return a total cost." };
    }
    return cost.ok ? cost : { ok: false, message: concealSecrets(cost.message, settings) };
  } catch (error) {
    logSafeError("blue dart shipment cost failed", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, message: "Blue Dart did not answer in time." };
    }
    return { ok: false, message: "Blue Dart did not return a total cost." };
  }
}

export async function requestTransitTime(
  settings: BlueDartSettings,
  input: TransitTimeInput,
  fetchImpl?: typeof fetch,
): Promise<TransitTimeResult> {
  try {
    const xml = await postBlueDart(blueDartFinderUrl, blueDartTransitAction, transitTimeEnvelope(input, settings), fetchImpl);
    const quote = readTransitTimeXml(xml);
    if (!quote) {
      return { ok: false, message: "Blue Dart did not return a delivery date." };
    }
    return quote.ok ? quote : { ok: false, message: concealSecrets(quote.message, settings) };
  } catch (error) {
    logSafeError("blue dart transit time failed", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, message: "Blue Dart did not answer in time." };
    }
    return { ok: false, message: "Blue Dart did not return a delivery date." };
  }
}

async function postBlueDart(url: string, action: string, body: string, fetchImpl?: typeof fetch): Promise<string> {
  if (fetchImpl) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"`,
      },
      body,
      redirect: "error",
    });
    return response.text();
  }
  return postSoap(url, action, body);
}

function postSoap(url: string, action: string, body: string): Promise<string> {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.hostname !== "netconnect.bluedart.com") {
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
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1_000_000) {
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
    request.write(body);
    request.end();
  });
}
