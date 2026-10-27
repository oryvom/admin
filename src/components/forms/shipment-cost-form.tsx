"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { shipmentCostInputSchema, type ShipmentCost, type ShipmentCostInput } from "@/lib/shipping/shipment-cost";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ShipmentCostForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<ShipmentCost | null>(null);
  const form = useForm<ShipmentCostInput>({
    resolver: zodResolver(shipmentCostInputSchema),
    defaultValues: {
      originPin: "",
      destinationPin: "",
      weightKg: "",
      boxes: "1",
      lengthCm: "",
      breadthCm: "",
      heightCm: "",
      productCode: "A",
      subProductCode: "P",
      productType: "Docs",
      declaredValue: "0",
    },
  });

  async function onSubmit(values: ShipmentCostInput) {
    setError(null);
    setCost(null);
    const response = await fetch("/api/shipments/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json()) as { error?: string; cost?: ShipmentCost };
    if (!response.ok || !payload.cost) {
      setError(payload.error ?? "Blue Dart did not return a total cost.");
      return;
    }
    setCost(payload.cost);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <Card>
        <CardHeader>
          <CardTitle>Shipment details</CardTitle>
          <CardDescription>
            Weight, number of boxes, and the length, breadth, and height of each box. The PIN codes and service tell Blue Dart which lane to price.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configured ? null : (
            <p className="mb-4 text-sm text-muted-foreground">
              Add BLUEDART_LOGIN_ID, BLUEDART_LICENCE_KEY, and BLUEDART_API_TYPE to the server environment, then reload the page.
            </p>
          )}
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormField
                control={form.control}
                name="originPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin PIN</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" maxLength={6} disabled={!configured} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destinationPin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination PIN</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" autoComplete="off" maxLength={6} disabled={!configured} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" disabled={!configured} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="boxes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Boxes</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" disabled={!configured} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lengthCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Length (cm)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" disabled={!configured} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="breadthCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Breadth (cm)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" disabled={!configured} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heightCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" disabled={!configured} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="declaredValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Declared value (₹)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" disabled={!configured} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="productCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product code</FormLabel>
                    <FormControl>
                      <Input maxLength={1} autoCapitalize="characters" className="uppercase" disabled={!configured} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subProductCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-product code</FormLabel>
                    <FormControl>
                      <Input maxLength={1} autoCapitalize="characters" className="uppercase" disabled={!configured} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Shipment type</FormLabel>
                    <FormControl>
                      <select className={selectClass} disabled={!configured} {...field}>
                        <option value="Docs">Documents</option>
                        <option value="Dutiables">Dutiable goods</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {error}
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <Button type="submit" disabled={!configured || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Checking the cost…" : "Get total cost"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total cost</CardTitle>
          <CardDescription>The amount Blue Dart returns for this shipment.</CardDescription>
        </CardHeader>
        <CardContent>
          {cost ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-lg font-semibold">{formatInr(cost.grandTotal)}</dd>
              </div>
              {cost.charges.map((charge) => (
                <div key={`${charge.name}-${charge.amount}`}>
                  <dt className="text-muted-foreground">{charge.name}</dt>
                  <dd>{formatInr(charge.amount)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">The total cost appears here after Blue Dart answers.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatInr(value: string): string {
  const numeric = value.replaceAll(",", "");
  if (!/^\d+(\.\d+)?$/.test(numeric)) {
    return value;
  }
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(numeric));
}
