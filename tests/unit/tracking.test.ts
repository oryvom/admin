import { describe, expect, it } from "vitest";
import { requestShipmentTracking } from "@/server/services/shipment-tracking";
import { readTrackingXml, shipmentTrackingInputSchema, trackingRequestUrl } from "@/lib/shipping/tracking";

const settings = {
  loginId: "login-id",
  licenceKey: "licence-key-value",
  apiType: "S",
  consumerKey: "consumer-key",
  consumerSecret: "consumer-secret-value",
};

const input = shipmentTrackingInputSchema.parse({
  number: "76662235090",
  numberKind: "awb",
});

describe("shipment tracking", () => {
  it("builds the tracking query from the waybill", () => {
    const url = new URL(trackingRequestUrl(settings, input));
    expect(url.origin + url.pathname).toBe("https://apigateway.bluedart.com/in/transportation/tracking/v1/shipment");
    expect(url.searchParams.get("handler")).toBe("tnt");
    expect(url.searchParams.get("action")).toBe("custawbquery");
    expect(url.searchParams.get("loginid")).toBe("login-id");
    expect(url.searchParams.get("lickey")).toBe("licence-key-value");
    expect(url.searchParams.get("numbers")).toBe("76662235090");
    expect(url.searchParams.get("format")).toBe("xml");
    expect(url.searchParams.get("scan")).toBe("1");
    expect(url.searchParams.get("verno")).toBe("1");
    expect(url.searchParams.get("awb")).toBe("awb");
  });

  it("reads status and scans", () => {
    const xml = `
      <ShipmentData>
        <Shipment RefNo="40091075" WaybillNo="76662235090">
          <Service>Dart Apex - Door To Door</Service>
          <PickUpDate>27 January 2023</PickUpDate>
          <PickUpTime>1728</PickUpTime>
          <Origin>MUMBAI</Origin>
          <Destination>GURUGRAM</Destination>
          <ProductType>Non Documents</ProductType>
          <Weight>1.0</Weight>
          <Status>SHIPMENT DELIVERED</Status>
          <StatusType>DL</StatusType>
          <ExpectedDeliveryDate>02 February 2023</ExpectedDeliveryDate>
          <StatusDate>30 January 2023</StatusDate>
          <StatusTime>11:41</StatusTime>
          <ReceivedBy>CO STAMP</ReceivedBy>
          <Scans>
            <ScanDetail>
              <Scan>SHIPMENT DELIVERED</Scan>
              <ScanCode>000</ScanCode>
              <ScanType>DL</ScanType>
              <ScanDate>30-Jan-2023</ScanDate>
              <ScanTime>11:41</ScanTime>
              <ScannedLocation>GURGAON CPC</ScannedLocation>
            </ScanDetail>
            <ScanDetail>
              <Scan>SHIPMENT PICKED UP</Scan>
              <ScanDate>27-Jan-2023</ScanDate>
              <ScanTime>17:28</ScanTime>
              <ScannedLocation>TOLICHOWKI E-TAIL CENTRE</ScannedLocation>
            </ScanDetail>
          </Scans>
        </Shipment>
      </ShipmentData>`;
    expect(readTrackingXml(xml)).toEqual({
      ok: true,
      tracking: {
        waybillNo: "76662235090",
        referenceNo: "40091075",
        status: "SHIPMENT DELIVERED",
        statusType: "DL",
        statusDate: "30 January 2023",
        statusTime: "11:41",
        service: "Dart Apex - Door To Door",
        productType: "Non Documents",
        weight: "1.0",
        origin: "MUMBAI",
        destination: "GURUGRAM",
        pickupDate: "27 January 2023",
        pickupTime: "17:28",
        expectedDeliveryDate: "02 February 2023",
        receivedBy: "CO STAMP",
        instructions: null,
        senderName: null,
        toAttention: null,
        scans: [
          { scan: "SHIPMENT DELIVERED", date: "30-Jan-2023", time: "11:41", location: "GURGAON CPC" },
          { scan: "SHIPMENT PICKED UP", date: "27-Jan-2023", time: "17:28", location: "TOLICHOWKI E-TAIL CENTRE" },
        ],
      },
    });
  });

  it("reads a gateway unauthorized body", () => {
    expect(
      readTrackingXml('{"status":401,"title":"Unauthorized","error-response":"Access to the resource is not allowed."}'),
    ).toEqual({
      ok: false,
      message: "Blue Dart did not accept the tracking request.",
    });
  });

  it("reads a tracking refusal", () => {
    expect(readTrackingXml("<ShipmentData><Error>License Mismatch</Error></ShipmentData>")).toEqual({
      ok: false,
      message: "License Mismatch",
    });
  });

  it("explains a licence mismatch", async () => {
    const result = await requestShipmentTracking(settings, input, trackingFetch(async () => new Response("<ShipmentData><Error>License Mismatch</Error></ShipmentData>")));
    expect(result).toEqual({ ok: false, message: "Blue Dart did not accept the licence key for tracking." });
  });

  it("hides a secret in a tracking refusal", async () => {
    const fetchImpl = trackingFetch(async (url) => {
      expect(url).toContain("lickey=licence-key-value");
      return new Response(`License mismatch ${settings.licenceKey}`, { status: 200 });
    });
    const result = await requestShipmentTracking(settings, input, fetchImpl);
    expect(result).toEqual({ ok: false, message: "Blue Dart refused the request." });
  });

  it("hides the consumer secret when the token is refused", async () => {
    const fetchImpl: typeof fetch = async () => new Response(`unauthorized ${settings.consumerSecret}`, { status: 401 });
    const result = await requestShipmentTracking(settings, input, fetchImpl);
    expect(result).toEqual({ ok: false, message: "Blue Dart did not accept the consumer key and secret." });
    expect(JSON.stringify(result)).not.toContain(settings.consumerSecret);
  });
});

function trackingFetch(onTrack: (url: string, init?: RequestInit) => Promise<Response> | Response): typeof fetch {
  return async (url, init) => {
    const href = String(url);
    const headers = new Headers(init?.headers);
    if (href.includes("/token/v1/login")) {
      expect(headers.get("ClientID")).toBe(settings.consumerKey);
      expect(headers.get("clientSecret")).toBe(settings.consumerSecret);
      return new Response(JSON.stringify({ JWTToken: "jwt-token-value" }));
    }
    expect(headers.get("JWTToken")).toBe("jwt-token-value");
    return onTrack(href, init);
  };
}
