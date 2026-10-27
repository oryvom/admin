import { z } from "zod";

export const blueDartTrackingUrl = "https://apigateway.bluedart.com/in/transportation/tracking/v1/shipment";

export const shipmentTrackingInputSchema = z.object({
  number: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,20}$/, { error: "Enter the waybill or reference number." }),
  numberKind: z.enum(["awb", "Ref"], { error: "Choose waybill or reference." }),
});

export type ShipmentTrackingInput = z.infer<typeof shipmentTrackingInputSchema>;

export type ShipmentScan = {
  scan: string;
  date: string | null;
  time: string | null;
  location: string | null;
};

export type ShipmentTracking = {
  waybillNo: string | null;
  referenceNo: string | null;
  status: string;
  statusType: string | null;
  statusDate: string | null;
  statusTime: string | null;
  service: string | null;
  productType: string | null;
  weight: string | null;
  origin: string | null;
  destination: string | null;
  pickupDate: string | null;
  pickupTime: string | null;
  expectedDeliveryDate: string | null;
  receivedBy: string | null;
  instructions: string | null;
  senderName: string | null;
  toAttention: string | null;
  scans: ShipmentScan[];
};

export function trackingRequestUrl(
  settings: { loginId: string; licenceKey: string },
  input: ShipmentTrackingInput,
): string {
  const params = new URLSearchParams({
    handler: "tnt",
    loginid: settings.loginId,
    numbers: input.number,
    format: "xml",
    lickey: settings.licenceKey,
    scan: "1",
    action: "custawbquery",
    verno: "1",
    awb: input.numberKind,
  });
  return `${blueDartTrackingUrl}?${params.toString()}`;
}

export function readTrackingXml(xml: string): { ok: true; tracking: ShipmentTracking } | { ok: false; message: string } | null {
  const shipment = /<(?:[A-Za-z0-9_]+:)?Shipment\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?Shipment>/.exec(xml);
  if (!shipment) {
    const error = xmlValue(xml, "Error") ?? plainMessage(xml);
    return error ? { ok: false, message: clip(error) } : null;
  }
  const body = shipment[2] ?? "";
  const status = xmlValue(body, "Status");
  if (!status) {
    const error = xmlValue(body, "Error") ?? xmlValue(xml, "Error");
    return error ? { ok: false, message: clip(error) } : null;
  }
  const scans = [...body.matchAll(/<(?:[A-Za-z0-9_]+:)?ScanDetail\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?ScanDetail>/g)]
    .flatMap((match) => {
      const detail = match[1] ?? "";
      const scan = xmlValue(detail, "Scan");
      if (!scan) {
        return [];
      }
      return [
        {
          scan,
          date: xmlValue(detail, "ScanDate"),
          time: xmlValue(detail, "ScanTime"),
          location: xmlValue(detail, "ScannedLocation"),
        },
      ];
    })
    .slice(0, 40);
  return {
    ok: true,
    tracking: {
      waybillNo: attribute(shipment[1] ?? "", "WaybillNo"),
      referenceNo: attribute(shipment[1] ?? "", "RefNo"),
      status,
      statusType: xmlValue(body, "StatusType"),
      statusDate: xmlValue(body, "StatusDate"),
      statusTime: xmlValue(body, "StatusTime"),
      service: xmlValue(body, "Service"),
      productType: xmlValue(body, "ProductType"),
      weight: xmlValue(body, "Weight"),
      origin: xmlValue(body, "Origin"),
      destination: xmlValue(body, "Destination"),
      pickupDate: xmlValue(body, "PickUpDate"),
      pickupTime: clockTime(xmlValue(body, "PickUpTime")),
      expectedDeliveryDate: xmlValue(body, "ExpectedDeliveryDate"),
      receivedBy: xmlValue(body, "ReceivedBy"),
      instructions: xmlValue(body, "Instructions"),
      senderName: xmlValue(body, "SenderName"),
      toAttention: xmlValue(body, "ToAttention"),
      scans,
    },
  };
}

function attribute(opening: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(opening);
  return match?.[1] ? clipField(decodeXml(match[1]), 40) : null;
}

function xmlValue(xml: string, localName: string): string | null {
  const pattern = new RegExp(`<(?:[A-Za-z0-9_]+:)?${localName}(?:\\s[^>]*)?>([^<]*)</(?:[A-Za-z0-9_]+:)?${localName}>`);
  const match = pattern.exec(xml);
  return match?.[1] ? clipField(decodeXml(match[1]), 80) : null;
}

function clockTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return /^\d{4}$/.test(value) ? `${value.slice(0, 2)}:${value.slice(2)}` : value;
}

function plainMessage(xml: string): string | null {
  if (/[<>]/.test(xml)) {
    return null;
  }
  const text = xml.replace(/[\u0000-\u001f]/g, " ").trim();
  if (!text) {
    return null;
  }
  if (text.startsWith("{") || text.startsWith("[")) {
    if (/unauthorized/i.test(text)) {
      return "Blue Dart did not accept the tracking request.";
    }
    if (/bad request/i.test(text)) {
      return "Check the tracking number.";
    }
    return "Blue Dart did not return a tracking status.";
  }
  return text;
}

function clip(message: string): string {
  return message.length > 180 ? "Blue Dart refused the tracking request." : message;
}

function clipField(value: string, max: number): string | null {
  const text = value.replace(/[\u0000-\u001f]/g, "").trim();
  if (!text) {
    return null;
  }
  return text.length > max ? text.slice(0, max) : text;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
