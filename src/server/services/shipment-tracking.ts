import https from "node:https";
import { logSafeError } from "@/lib/security/log";
import { concealSecrets, type BlueDartGatewaySettings } from "@/lib/shipping/transit-time";
import {
  readTrackingXml,
  trackingRequestUrl,
  type ShipmentTracking,
  type ShipmentTrackingInput,
} from "@/lib/shipping/tracking";
import { blueDartJwt } from "@/server/services/bluedart-auth";

export type ShipmentTrackingResult = { ok: true; tracking: ShipmentTracking } | { ok: false; message: string };

export async function requestShipmentTracking(
  settings: BlueDartGatewaySettings,
  input: ShipmentTrackingInput,
  fetchImpl?: typeof fetch,
): Promise<ShipmentTrackingResult> {
  try {
    const token = await blueDartJwt(settings, fetchImpl);
    if (!token) {
      console.info(JSON.stringify({ message: "blue dart tracking", jwtAttached: false, tokenLength: 0 }));
      return { ok: false, message: "Blue Dart did not accept the consumer key and secret." };
    }
    const response = await getBlueDart(trackingRequestUrl(settings, input), fetchImpl, { JWTToken: token });
    const tracking = readTrackingXml(response.body);
    const failure = tracking && !tracking.ok ? trackingFailure(tracking.message, settings) : null;
    console.info(JSON.stringify({
      message: "blue dart tracking",
      jwtAttached: true,
      tokenLength: token.length,
      loginId: "BLUEDART_LOGIN_ID",
      licenceKey: "BLUEDART_LICENCE_KEY",
      httpStatus: response.status,
      result: tracking?.ok ? "status" : failure ?? "no status",
    }));
    if (!tracking) {
      return { ok: false, message: "Blue Dart did not return a tracking status." };
    }
    return tracking.ok ? tracking : { ok: false, message: failure ?? "Blue Dart did not return a tracking status." };
  } catch (error) {
    logSafeError("blue dart tracking failed", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, message: "Blue Dart did not answer in time." };
    }
    return { ok: false, message: "Blue Dart did not return a tracking status." };
  }
}

function trackingFailure(message: string, settings: BlueDartGatewaySettings): string {
  const safe = concealSecrets(message, settings);
  if (safe.toLowerCase() === "license mismatch") {
    return "Blue Dart did not accept the licence key for tracking.";
  }
  return safe;
}

function getBlueDart(url: string, fetchImpl: typeof fetch | undefined, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  if (fetchImpl) {
    return fetchImpl(url, { method: "GET", headers, redirect: "error" }).then(async (response) => ({
      status: response.status,
      body: await response.text(),
    }));
  }
  const target = new URL(url);
  const allowedPath = target.pathname === "/in/transportation/tracking/v1/shipment";
  if (target.protocol !== "https:" || target.hostname !== "apigateway.bluedart.com" || !allowedPath) {
    return Promise.reject(new Error("Blue Dart address is not allowed."));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, result?: { status: number; body: string }) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error);
        return;
      }
      resolve(result ?? { status: 0, body: "" });
    };
    const request = https.request(
      {
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        headers,
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
        response.on("end", () => finish(undefined, { status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
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
