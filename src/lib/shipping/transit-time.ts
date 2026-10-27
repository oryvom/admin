import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ServerEnv } from "@/lib/config/env";
import { type ShipmentCost, type ShipmentCostInput } from "@/lib/shipping/shipment-cost";

export { shipmentCostInputSchema, type ShipmentCharge, type ShipmentCost, type ShipmentCostInput } from "@/lib/shipping/shipment-cost";

export const blueDartFinderUrl = "https://netconnect.bluedart.com/Ver1.11/ShippingAPI/Finder/ServiceFinderQuery.svc";
export const blueDartTransitAction = "http://tempuri.org/IServiceFinderQuery/GetDomesticTransitTimeForPinCodeandProduct";
export const blueDartRateAction = "http://tempuri.org/IServiceFinderQuery/GetRateInfo";

const adminNamespace = "http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin";
const dimensionNamespace = "http://schemas.datacontract.org/2004/07/SAPI.Entities.WayBillGeneration";

const letter = z.string().trim().toUpperCase().regex(/^[A-Z]$/, { error: "Use one letter, such as A." });

export const transitTimeInputSchema = z.object({
  originPin: z.string().trim().regex(/^[1-9]\d{5}$/, { error: "Enter a 6-digit origin PIN." }),
  destinationPin: z.string().trim().regex(/^[1-9]\d{5}$/, { error: "Enter a 6-digit destination PIN." }),
  pickupDate: z.string().trim().refine(isCalendarDate, { error: "Choose a pickup date." }),
  pickupTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Choose a pickup time." }),
  productCode: letter,
  subProductCode: letter,
});

export type TransitTimeInput = z.infer<typeof transitTimeInputSchema>;

export type BlueDartSettings = {
  loginId: string;
  licenceKey: string;
  apiType: string;
};

export type BlueDartGatewaySettings = BlueDartSettings & {
  consumerKey: string;
  consumerSecret: string;
};

export type TransitTimeQuote = {
  expectedDeliveryDate: string;
  expectedPodDate: string | null;
  originCity: string | null;
  destinationCity: string | null;
  area: string | null;
  serviceCenter: string | null;
};

export function readBlueDartSettings(env: ServerEnv): BlueDartSettings | null {
  const loginId = cleanCredential(env.BLUEDART_LOGIN_ID);
  const licenceKey = cleanCredential(env.BLUEDART_LICENCE_KEY);
  const apiType = cleanCredential(env.BLUEDART_API_TYPE);
  if (!loginId || !licenceKey || !apiType) {
    return null;
  }
  return { loginId, licenceKey, apiType };
}

export function readBlueDartGatewaySettings(env: ServerEnv): BlueDartGatewaySettings | null {
  const settings = readBlueDartSettings(env);
  const consumerKey = cleanCredential(env.BLUEDART_CONSUMER_KEY);
  const consumerSecret = cleanCredential(env.BLUEDART_CONSUMER_SECRET);
  if (!settings || !consumerKey || !consumerSecret) {
    return null;
  }
  return { ...settings, consumerKey, consumerSecret };
}

export function transitTimeEnvelope(input: TransitTimeInput, settings: BlueDartSettings, messageId = randomUUID()): string {
  const profileNamespace = "http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin";
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">
  <s:Header>
    <a:Action s:mustUnderstand="1">${blueDartTransitAction}</a:Action>
    <a:To s:mustUnderstand="1">${blueDartFinderUrl}</a:To>
    <a:MessageID>urn:uuid:${xmlEscape(messageId)}</a:MessageID>
  </s:Header>
  <s:Body>
    <GetDomesticTransitTimeForPinCodeandProduct xmlns="http://tempuri.org/">
      <pPinCodeFrom>${xmlEscape(input.originPin)}</pPinCodeFrom>
      <pPinCodeTo>${xmlEscape(input.destinationPin)}</pPinCodeTo>
      <pProductCode>${xmlEscape(input.productCode)}</pProductCode>
      <pSubProductCode>${xmlEscape(input.subProductCode)}</pSubProductCode>
      <pPudate>${xmlEscape(input.pickupDate)}T${xmlEscape(input.pickupTime)}:00</pPudate>
      <pPickupTime>${xmlEscape(input.pickupTime)}</pPickupTime>
      <profile>
        <Api_type xmlns="${profileNamespace}">${xmlEscape(settings.apiType)}</Api_type>
        <LicenceKey xmlns="${profileNamespace}">${xmlEscape(settings.licenceKey)}</LicenceKey>
        <LoginID xmlns="${profileNamespace}">${xmlEscape(settings.loginId)}</LoginID>
        <Version xmlns="${profileNamespace}">1.11</Version>
      </profile>
    </GetDomesticTransitTimeForPinCodeandProduct>
  </s:Body>
</s:Envelope>`;
}

export function shipmentCostEnvelope(input: ShipmentCostInput, settings: BlueDartSettings, messageId = randomUUID()): string {
  const field = (name: string, value: string | number) =>
    `<${name} xmlns="${adminNamespace}">${xmlEscape(String(value))}</${name}>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">
  <s:Header>
    <a:Action s:mustUnderstand="1">${blueDartRateAction}</a:Action>
    <a:To s:mustUnderstand="1">${blueDartFinderUrl}</a:To>
    <a:MessageID>urn:uuid:${xmlEscape(messageId)}</a:MessageID>
  </s:Header>
  <s:Body>
    <GetRateInfo xmlns="http://tempuri.org/">
      <Request>
        ${field("ActualWeight", input.weightKg)}
        ${field("ConsigneePincode", input.destinationPin)}
        ${field("CustomerPincode", input.originPin)}
        ${field("DeclaredValue", input.declaredValue)}
        <Dimensions xmlns="${adminNamespace}">
          <Dimension xmlns="${dimensionNamespace}">
            <Breadth>${xmlEscape(String(input.breadthCm))}</Breadth>
            <Count>${xmlEscape(String(input.boxes))}</Count>
            <Height>${xmlEscape(String(input.heightCm))}</Height>
            <Length>${xmlEscape(String(input.lengthCm))}</Length>
          </Dimension>
        </Dimensions>
        ${field("PieceCount", input.boxes)}
        ${field("ProductCode", input.productCode)}
        ${field("ProductType", input.productType)}
        ${field("SubProductCode", input.subProductCode)}
      </Request>
      <Profile>
        <Api_type xmlns="${adminNamespace}">${xmlEscape(settings.apiType)}</Api_type>
        <LicenceKey xmlns="${adminNamespace}">${xmlEscape(settings.licenceKey)}</LicenceKey>
        <LoginID xmlns="${adminNamespace}">${xmlEscape(settings.loginId)}</LoginID>
        <Version xmlns="${adminNamespace}">1.11</Version>
      </Profile>
    </GetRateInfo>
  </s:Body>
</s:Envelope>`;
}

export function readShipmentCostXml(xml: string): { ok: true; cost: ShipmentCost } | { ok: false; message: string } | null {
  const isError = xmlValue(xml, "IsError")?.toLowerCase() === "true";
  const message = xmlValue(xml, "ErrorMessage");
  if (isError) {
    return { ok: false, message: message && message.toLowerCase() !== "valid" ? clip(message) : "Blue Dart rejected this shipment." };
  }
  const grandTotal = xmlValue(xml, "GrandTotal");
  const total = xmlValue(xml, "Total");
  if (!grandTotal && !total) {
    const fault = xmlValue(xml, "Text") ?? xmlValue(xml, "faultstring");
    return fault ? { ok: false, message: clip(fault) } : null;
  }
  const names = xmlValues(xml, "chargeName");
  const amounts = xmlValues(xml, "chargeAmt");
  const charges = names.flatMap((name, index) => {
    const amount = amounts[index];
    return amount ? [{ name, amount }] : [];
  });
  return {
    ok: true,
    cost: {
      grandTotal: grandTotal ?? total ?? "",
      total,
      serviceTax: xmlValue(xml, "ServiceTax"),
      charges,
    },
  };
}

export function readTransitTimeQuote(payload: unknown): { ok: true; quote: TransitTimeQuote } | { ok: false; message: string } | null {
  const record = findResult(payload, 0);
  if (!record) {
    return null;
  }
  const message = readText(record, "ErrorMessage", 180);
  if (record.IsError === true) {
    return { ok: false, message: message && message.toLowerCase() !== "valid" ? message : "Blue Dart rejected this shipment." };
  }
  const expectedDeliveryDate = readText(record, "ExpectedDateDelivery", 40);
  if (!expectedDeliveryDate) {
    return message && message.toLowerCase() !== "valid" ? { ok: false, message } : null;
  }
  return {
    ok: true,
    quote: {
      expectedDeliveryDate,
      expectedPodDate: readText(record, "ExpectedDatePOD", 40),
      originCity: readText(record, "CityDesc_Origin", 80),
      destinationCity: readText(record, "CityDesc_Destination", 80),
      area: readText(record, "Area", 20),
      serviceCenter: readText(record, "ServiceCenter", 20),
    },
  };
}

export function readTransitTimeXml(xml: string): { ok: true; quote: TransitTimeQuote } | { ok: false; message: string } | null {
  const quote = readTransitTimeQuote({
    ExpectedDateDelivery: xmlValue(xml, "ExpectedDateDelivery"),
    ExpectedDatePOD: xmlValue(xml, "ExpectedDatePOD"),
    CityDesc_Origin: xmlValue(xml, "CityDesc_Origin"),
    CityDesc_Destination: xmlValue(xml, "CityDesc_Destination"),
    Area: xmlValue(xml, "Area"),
    ServiceCenter: xmlValue(xml, "ServiceCenter"),
    ErrorMessage: xmlValue(xml, "ErrorMessage"),
    IsError: xmlValue(xml, "IsError")?.toLowerCase() === "true",
  });
  if (quote) {
    return quote;
  }
  const fault = xmlValue(xml, "Text") ?? xmlValue(xml, "faultstring");
  if (!fault) {
    return null;
  }
  return { ok: false, message: fault.length > 180 ? "Blue Dart refused the request." : fault };
}

export function concealSecrets(
  message: string,
  settings: BlueDartSettings & { consumerKey?: string; consumerSecret?: string },
): string {
  const secrets = [settings.loginId, settings.licenceKey, settings.apiType, settings.consumerKey, settings.consumerSecret];
  if (secrets.some((secret) => secret && secret.length > 3 && message.includes(secret))) {
    return "Blue Dart refused the request.";
  }
  return message;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2020 || year > 2100) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function cleanCredential(value: string | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || text.startsWith("replace-with") || /[\u0000-\u001f]/.test(text) || text.length > 500) {
    return null;
  }
  return text;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlValue(xml: string, localName: string): string | null {
  return xmlValues(xml, localName)[0] ?? null;
}

function xmlValues(xml: string, localName: string): string[] {
  const pattern = new RegExp(`<(?:[A-Za-z0-9_]+:)?${localName}(?:\\s[^>]*)?>([^<]*)</(?:[A-Za-z0-9_]+:)?${localName}>`, "g");
  return [...xml.matchAll(pattern)].flatMap((match) => {
    const text = decodeXml((match[1] ?? "").trim());
    return text ? [text] : [];
  });
}

function clip(message: string): string {
  return message.length > 180 ? "Blue Dart refused the request." : message;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function findResult(value: unknown, depth: number): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || depth > 5) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findResult(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if ("ExpectedDateDelivery" in record || "IsError" in record) {
    return record;
  }
  for (const nested of Object.values(record)) {
    const found = findResult(nested, depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
}

function readText(record: Record<string, unknown>, key: string, max: number): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  if (!text || text.length > max || /[\u0000-\u001f]/.test(text)) {
    return null;
  }
  return text;
}
