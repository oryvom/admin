"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { INDIAN_STATES, indianStateName } from "@/lib/company/india";
import { MAX_ADDITIONAL_OFFICE_DOCUMENTS } from "@/lib/validation/office";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OfficeListItem = {
  id: string;
  gstin: string;
  addressLine1: string;
  city: string;
  district: string;
  stateCode: string;
  pinCode: string;
  propertyType: string;
  documents: { id: string; title: string; originalName: string }[];
};

export function OfficesPanel({ canWrite, offices }: { canWrite: boolean; offices: OfficeListItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-6">
      {canWrite ? (
        <Button
          type="button"
          onClick={() => {
            setFormKey((value) => value + 1);
            setOpen(true);
          }}
        >
          Add office
        </Button>
      ) : null}
      {offices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No office records have been added yet.</p>
      ) : (
        <ul className="grid max-w-3xl gap-4">
          {offices.map((office) => (
            <li key={office.id} className="space-y-3 rounded-xl border border-border p-4">
              <div>
                <p className="text-sm text-muted-foreground">GSTIN</p>
                <p className="font-medium">{office.gstin}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registered address</p>
                <p className="font-medium">{formatOfficeAddress(office)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Property type</p>
                <p className="font-medium">{office.propertyType === "rented" ? "Rented" : office.propertyType}</p>
              </div>
              <ul className="space-y-2">
                {office.documents.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">{document.title}</span>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/company-offices/documents/${document.id}`}>Download</a>
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add office</DialogTitle>
            <DialogDescription>GSTIN, registered address, and office documents.</DialogDescription>
          </DialogHeader>
          {open ? (
            <OfficeDialogForm
              key={formKey}
              onSaved={() => {
                setOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfficeDialogForm({ onSaved }: { onSaved: () => void }) {
  const [propertyType, setPropertyType] = useState("rented");
  const [extras, setExtras] = useState<{ key: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/api/company-offices", { method: "POST", body: new FormData(event.currentTarget) });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(payload?.error ?? "The office could not be saved.");
      return;
    }
    onSaved();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="gstin">GSTIN</Label>
        <Input id="gstin" name="gstin" required autoComplete="off" maxLength={15} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1</Label>
        <Input id="addressLine1" name="addressLine1" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input id="district" name="district" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stateCode">State</Label>
          <select
            id="stateCode"
            name="stateCode"
            required
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose a state</option>
            {INDIAN_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pinCode">PIN code</Label>
          <Input id="pinCode" name="pinCode" required inputMode="numeric" autoComplete="postal-code" maxLength={6} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="propertyType">Property type</Label>
        <select
          id="propertyType"
          name="propertyType"
          value={propertyType}
          onChange={(event) => setPropertyType(event.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="rented">Rented</option>
        </select>
      </div>
      <FileField id="gstCertificate" name="gstCertificate" label="GST certificate" />
      {propertyType === "rented" ? <FileField id="rentAgreement" name="rentAgreement" label="Rent agreement" /> : null}
      {extras.map((extra, index) => (
        <div key={extra.key} className="grid gap-3 rounded-lg border border-border p-3">
          <div className="space-y-2">
            <Label htmlFor={`${extra.key}-title`}>Document title</Label>
            <Input id={`${extra.key}-title`} name="additionalTitle" required maxLength={80} />
          </div>
          <FileField id={`${extra.key}-file`} name="additionalFile" label="Document file" />
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() => setExtras((current) => current.filter((item) => item.key !== extra.key))}
          >
            Remove document {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={extras.length >= MAX_ADDITIONAL_OFFICE_DOCUMENTS}
        onClick={() => setExtras((current) => [...current, { key: crypto.randomUUID() }])}
      >
        Add document
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save office"}
      </Button>
    </form>
  );
}

function FileField({ id, name, label }: { id: string; name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="file" required accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" />
    </div>
  );
}

function formatOfficeAddress(office: OfficeListItem): string {
  const state = office.stateCode ? `${indianStateName(office.stateCode)} (${office.stateCode})` : "";
  return [office.addressLine1, office.city, office.district, state, office.pinCode].map((part) => part.trim()).filter(Boolean).join(", ");
}
