import { describe, expect, it } from "vitest";
import type { ServerEnv } from "@/lib/config/env";
import { requestShipmentCost, requestTransitTime } from "@/server/services/bluedart-service";
import {
  blueDartFinderUrl,
  readBlueDartGatewaySettings,
  readBlueDartSettings,
  readShipmentCostXml,
  readTransitTimeXml,
  shipmentCostEnvelope,
  shipmentCostInputSchema,
  transitTimeEnvelope,
  transitTimeInputSchema,
  type BlueDartSettings,
} from "@/lib/shipping/transit-time";

const settings: BlueDartSettings = {
  loginId: "login-id",
  licenceKey: "licence-key-value",
  apiType: "S",
};

const input = transitTimeInputSchema.parse({
  originPin: "400012",
  destinationPin: "110001",
  pickupDate: "2026-10-23",
  pickupTime: "16:00",
  productCode: "a",
  subProductCode: "p",
});

describe("transit time request", () => {
  it("builds a finder request with the login id, licence key, and API type", () => {
    const envelope = transitTimeEnvelope(input, settings, "11111111-1111-1111-1111-111111111111");
    expect(envelope).toContain("https://netconnect.bluedart.com/Ver1.11/ShippingAPI/Finder/ServiceFinderQuery.svc");
    expect(envelope).toContain("GetDomesticTransitTimeForPinCodeandProduct");
    expect(envelope).toContain("<pPinCodeFrom>400012</pPinCodeFrom>");
    expect(envelope).toContain("<pPinCodeTo>110001</pPinCodeTo>");
    expect(envelope).toContain("<pProductCode>A</pProductCode>");
    expect(envelope).toContain("<pSubProductCode>P</pSubProductCode>");
    expect(envelope).toContain("<pPudate>2026-10-23T16:00:00</pPudate>");
    expect(envelope).toContain("<pPickupTime>16:00</pPickupTime>");
    expect(envelope).toContain("<Api_type xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">S</Api_type>");
    expect(envelope).toContain("<LoginID xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">login-id</LoginID>");
    expect(envelope).toContain("<LicenceKey xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">licence-key-value</LicenceKey>");
    expect(envelope).toContain("<Version xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">1.11</Version>");
  });

  it("reads the expected delivery date from the SOAP response", () => {
    const xml = `
      <GetDomesticTransitTimeForPinCodeandProductResult>
        <b:Area>BOM</b:Area>
        <b:CityDesc_Destination>DELHI</b:CityDesc_Destination>
        <b:CityDesc_Origin>MUMBAI</b:CityDesc_Origin>
        <b:ErrorMessage>Valid</b:ErrorMessage>
        <b:ExpectedDateDelivery>27-MAY-22</b:ExpectedDateDelivery>
        <b:ExpectedDatePOD>27-MAY-22</b:ExpectedDatePOD>
        <b:IsError>false</b:IsError>
        <b:ServiceCenter>ADR</b:ServiceCenter>
      </GetDomesticTransitTimeForPinCodeandProductResult>`;
    expect(readTransitTimeXml(xml)).toEqual({
      ok: true,
      quote: {
        expectedDeliveryDate: "27-MAY-22",
        expectedPodDate: "27-MAY-22",
        originCity: "MUMBAI",
        destinationCity: "DELHI",
        area: "BOM",
        serviceCenter: "ADR",
      },
    });
    expect(readTransitTimeXml("<b:IsError>true</b:IsError><b:ErrorMessage>Invalid pincode</b:ErrorMessage>")).toEqual({
      ok: false,
      message: "Invalid pincode",
    });
  });

  it("requires the login id, licence key, and API type", () => {
    const env = {
      BLUEDART_LOGIN_ID: "login-id",
      BLUEDART_LICENCE_KEY: "licence-key-value",
      BLUEDART_API_TYPE: "S",
    } as ServerEnv;
    expect(readBlueDartSettings(env)).toEqual(settings);
    expect(readBlueDartSettings({ ...env, BLUEDART_API_TYPE: undefined })).toBeNull();
    expect(readBlueDartGatewaySettings({ ...env, BLUEDART_CONSUMER_KEY: "consumer-key", BLUEDART_CONSUMER_SECRET: "consumer-secret-value" })).toEqual({
      ...settings,
      consumerKey: "consumer-key",
      consumerSecret: "consumer-secret-value",
    });
    expect(readBlueDartGatewaySettings(env)).toBeNull();
  });

  it("posts to the finder service and drops secrets from a fault", async () => {
    let called = "";
    const fetchImpl: typeof fetch = async (url, init) => {
      called = `${init?.method} ${String(url)}`;
      return new Response(`<s:Text>refused ${settings.licenceKey}</s:Text>`, { status: 500 });
    };
    const result = await requestTransitTime(settings, input, fetchImpl);
    expect(called).toBe(`POST ${blueDartFinderUrl}`);
    expect(result).toEqual({ ok: false, message: "Blue Dart refused the request." });
    expect(JSON.stringify(result)).not.toContain(settings.licenceKey);
  });
});

describe("shipment cost request", () => {
  const costInput = shipmentCostInputSchema.parse({
    originPin: "400012",
    destinationPin: "110001",
    weightKg: "1.5",
    boxes: "2",
    lengthCm: "30",
    breadthCm: "20",
    heightCm: "15",
    productCode: "a",
    subProductCode: "p",
    productType: "Docs",
    declaredValue: "0",
  });

  it("sends weight, boxes, and dimensions to GetRateInfo", () => {
    const envelope = shipmentCostEnvelope(costInput, settings, "11111111-1111-1111-1111-111111111111");
    expect(envelope).toContain("GetRateInfo");
    expect(envelope).toContain(">1.5<");
    expect(envelope).toContain("<PieceCount xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">2</PieceCount>");
    expect(envelope).toContain("<Length>30</Length>");
    expect(envelope).toContain("<Breadth>20</Breadth>");
    expect(envelope).toContain("<Height>15</Height>");
    expect(envelope).toContain("<Count>2</Count>");
    expect(envelope).toContain("<CustomerPincode xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">400012</CustomerPincode>");
    expect(envelope).toContain("<ConsigneePincode xmlns=\"http://schemas.datacontract.org/2004/07/SAPI.Entities.Admin\">110001</ConsigneePincode>");
    expect(envelope).toContain(">Docs<");
  });

  it("reads the grand total and charge lines", () => {
    const xml = `
      <GetRateInfoResult>
        <Charges>
          <Charges><chargeAmt>120.00</chargeAmt><chargeName>Freight</chargeName></Charges>
          <Charges><chargeAmt>21.60</chargeAmt><chargeName>Tax</chargeName></Charges>
        </Charges>
        <ErrorMessage></ErrorMessage>
        <GrandTotal>141.60</GrandTotal>
        <IsError>false</IsError>
        <ServiceTax>21.60</ServiceTax>
        <Total>120.00</Total>
      </GetRateInfoResult>`;
    expect(readShipmentCostXml(xml)).toEqual({
      ok: true,
      cost: {
        grandTotal: "141.60",
        total: "120.00",
        serviceTax: "21.60",
        charges: [
          { name: "Freight", amount: "120.00" },
          { name: "Tax", amount: "21.60" },
        ],
      },
    });
  });

  it("posts the rate request and hides a secret in the fault", async () => {
    const fetchImpl: typeof fetch = async () => new Response(`<s:Text>refused ${settings.licenceKey}</s:Text>`, { status: 500 });
    const result = await requestShipmentCost(settings, costInput, fetchImpl);
    expect(result).toEqual({ ok: false, message: "Blue Dart refused the request." });
  });
});
