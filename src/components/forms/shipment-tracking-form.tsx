"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { shipmentTrackingInputSchema, type ShipmentTracking, type ShipmentTrackingInput } from "@/lib/shipping/tracking";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ShipmentTrackingForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const form = useForm<ShipmentTrackingInput>({
    resolver: zodResolver(shipmentTrackingInputSchema),
    defaultValues: {
      number: "",
      numberKind: "awb",
    },
  });

  async function onSubmit(values: ShipmentTrackingInput) {
    setError(null);
    setTracking(null);
    const response = await fetch("/api/shipments/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string; tracking?: ShipmentTracking };
    if (!response.ok || !payload.tracking) {
      setError(payload.error ?? "Blue Dart did not return a tracking status.");
      return;
    }
    setTracking(payload.tracking);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Tracking number</CardTitle>
          <CardDescription>A Blue Dart waybill, or the reference number used when the shipment was booked.</CardDescription>
        </CardHeader>
        <CardContent>
          {configured ? null : (
            <p className="mb-4 text-sm text-muted-foreground">
              Add BLUEDART_LOGIN_ID, BLUEDART_LICENCE_KEY, BLUEDART_API_TYPE, BLUEDART_CONSUMER_KEY, and BLUEDART_CONSUMER_SECRET to the server environment, then reload the page.
            </p>
          )}
          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormField
                control={form.control}
                name="numberKind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number type</FormLabel>
                    <FormControl>
                      <select className={selectClass} disabled={!configured} {...field}>
                        <option value="awb">Waybill</option>
                        <option value="Ref">Reference</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" maxLength={20} disabled={!configured} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div>
                <Button type="submit" disabled={!configured || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Checking Blue Dart…" : "Track shipment"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>The latest status and scan history Blue Dart returns.</CardDescription>
        </CardHeader>
        <CardContent>
          {tracking ? <TrackingResult tracking={tracking} /> : (
            <p className="text-sm text-muted-foreground">The status appears here after Blue Dart answers.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrackingResult({ tracking }: { tracking: ShipmentTracking }) {
  const facts = [
    ["Waybill", tracking.waybillNo],
    ["Reference", tracking.referenceNo],
    ["Service", tracking.service],
    ["Shipment type", tracking.productType],
    ["Weight", tracking.weight ? `${tracking.weight} kg` : null],
    ["From", tracking.origin],
    ["To", tracking.destination],
    ["Picked up", joinParts(tracking.pickupDate, tracking.pickupTime)],
    ["Expected delivery", tracking.expectedDeliveryDate],
    ["Status time", joinParts(tracking.statusDate, tracking.statusTime)],
    ["Received by", tracking.receivedBy],
    ["From sender", tracking.senderName],
    ["Attention", tracking.toAttention],
    ["Instructions", tracking.instructions],
  ].flatMap(([label, value]) => (value ? [{ label, value }] : []));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Current status</p>
        <p className="text-lg font-semibold">{tracking.status}</p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {tracking.scans.length > 0 ? (
        <ol className="space-y-3 border-t border-border pt-4">
          {tracking.scans.map((scan, index) => (
            <li key={`${scan.scan}-${scan.date}-${scan.time}-${index}`} className="text-sm">
              <p className="font-medium">{scan.scan}</p>
              <p className="text-muted-foreground">{joinParts(scan.date, scan.time, scan.location)}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function joinParts(...parts: Array<string | null>): string | null {
  const text = parts.filter((part) => part && part.length > 0).join(" · ");
  return text.length > 0 ? text : null;
}
