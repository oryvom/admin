"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { saveCompanyProfileAction } from "@/features/company-data/actions";
import { COMPANY_DOCUMENT_TYPES, INDIAN_STATES, companyDocumentLabel, indianStateName } from "@/lib/company/india";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CompanyFormValues = {
  companyName: string;
  cin: string;
  pan: string;
  tan: string;
  addressLine1: string;
  city: string;
  district: string;
  stateCode: string;
  pinCode: string;
};

export type CompanyDocumentItem = {
  id: string;
  documentType: string;
  originalName: string;
  byteSize: number;
  createdAt: string;
};

export function CompanyAdministrationForm({
  canWrite,
  storageConfigured,
  profile,
  documents,
}: {
  canWrite: boolean;
  storageConfigured: boolean;
  profile: CompanyFormValues | null;
  documents: CompanyDocumentItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<string | null>(null);
  const identity = identityDetails(profile);
  const address = addressDetails(profile);
  const addressLine = address.map((item) => item.value.trim()).filter(Boolean).join(", ");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await saveCompanyProfileAction({
      companyName: String(form.get("companyName") ?? ""),
      cin: String(form.get("cin") ?? ""),
      pan: String(form.get("pan") ?? ""),
      tan: String(form.get("tan") ?? ""),
      addressLine1: String(form.get("addressLine1") ?? ""),
      city: String(form.get("city") ?? ""),
      district: String(form.get("district") ?? ""),
      stateCode: String(form.get("stateCode") ?? ""),
      pinCode: String(form.get("pinCode") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Company details saved.");
    setEditing(false);
    router.refresh();
  }

  async function copyValue(name: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(name);
      window.setTimeout(() => {
        setCopiedField((current) => (current === name ? null : current));
      }, 2000);
    } catch {
      setError("The value could not be copied.");
    }
  }

  async function upload(documentType: string, file: File | null) {
    if (!file) {
      return;
    }
    setError(null);
    setMessage(null);
    setUploadType(documentType);
    const body = new FormData();
    body.set("documentType", documentType);
    body.set("file", file);
    const response = await fetch("/api/company-administration/documents", { method: "POST", body });
    setUploadType(null);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "The document could not be uploaded.");
      return;
    }
    setMessage(`${companyDocumentLabel(documentType)} uploaded.`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {editing ? (
        <form key="edit" className="max-w-3xl space-y-8" onSubmit={save}>
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Company details</h2>
            <Field name="companyName" label="Company name" defaultValue={profile?.companyName} />
            <div className="grid gap-4 md:grid-cols-3">
              <Field name="cin" label="Corporate Identification Number" defaultValue={profile?.cin} />
              <Field name="pan" label="Permanent Account Number" defaultValue={profile?.pan} />
              <Field name="tan" label="Tax Deduction and Collection Account Number" defaultValue={profile?.tan} />
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-medium">Registered address</h2>
            <Field name="addressLine1" label="Address line 1" defaultValue={profile?.addressLine1} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field name="city" label="City" defaultValue={profile?.city} />
              <Field name="district" label="District" defaultValue={profile?.district} />
              <div className="space-y-2">
                <Label htmlFor="stateCode">State</Label>
                <select
                  id="stateCode"
                  name="stateCode"
                  defaultValue={profile?.stateCode ?? ""}
                  required
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
              <Field name="pinCode" label="PIN code" defaultValue={profile?.pinCode} inputMode="numeric" autoComplete="postal-code" maxLength={6} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="w-fit" disabled={pending}>
                {pending ? "Saving…" : "Save company details"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setError(null); }}>
                Cancel
              </Button>
            </div>
          </section>
        </form>
      ) : (
        <>
          <section className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Company details</h2>
              {canWrite ? (
                <Button type="button" variant="outline" onClick={() => { setEditing(true); setError(null); }}>
                  Edit
                </Button>
              ) : null}
            </div>
            <DetailList items={identity} copiedField={copiedField} onCopy={copyValue} />
          </section>
          <section className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Registered address</h2>
              <Button type="button" variant="outline" disabled={!addressLine} onClick={() => void copyValue("address", addressLine)}>
                {copiedField === "address" ? "Copied" : "Copy"}
              </Button>
            </div>
            <DetailList items={address} />
          </section>
        </>
      )}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {canWrite ? null : (
        <p className="text-sm text-muted-foreground">You can view these records. Updating them requires administration permission.</p>
      )}

      <section className="max-w-3xl space-y-3">
        <h2 className="text-lg font-medium">Documents</h2>
        <p className="text-sm text-muted-foreground">PDF, JPEG, or PNG. Maximum 10 MB. Files are stored outside this application.</p>
        {storageConfigured ? null : (
          <p className="text-sm text-destructive">Document storage is not configured, so files cannot be uploaded yet.</p>
        )}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {COMPANY_DOCUMENT_TYPES.map((document) => {
            const current = documents.find((item) => item.documentType === document.key);
            return (
              <li key={document.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{document.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {current ? `${current.originalName} · ${formatBytes(current.byteSize)}` : "No file uploaded"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {current ? (
                    <Button variant="outline" asChild>
                      <a href={`/api/company-administration/documents/${current.id}`}>Download</a>
                    </Button>
                  ) : null}
                  {canWrite && storageConfigured ? (
                    <Label className="cursor-pointer">
                      <Input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                        className="sr-only"
                        disabled={uploadType === document.key}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = "";
                          void upload(document.key, file);
                        }}
                      />
                      <span className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm">
                        {uploadType === document.key ? "Uploading…" : current ? "Replace" : "Upload"}
                      </span>
                    </Label>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function identityDetails(profile: CompanyFormValues | null) {
  return [
    { name: "companyName", label: "Company name", value: profile?.companyName ?? "" },
    { name: "cin", label: "Corporate Identification Number", value: profile?.cin ?? "" },
    { name: "pan", label: "Permanent Account Number", value: profile?.pan ?? "" },
    { name: "tan", label: "Tax Deduction and Collection Account Number", value: profile?.tan ?? "" },
  ];
}

function addressDetails(profile: CompanyFormValues | null) {
  const state = profile?.stateCode ? `${indianStateName(profile.stateCode)} (${profile.stateCode})` : "";
  return [
    { name: "addressLine1", label: "Address line 1", value: profile?.addressLine1 ?? "" },
    { name: "city", label: "City", value: profile?.city ?? "" },
    { name: "district", label: "District", value: profile?.district ?? "" },
    { name: "stateCode", label: "State", value: state },
    { name: "pinCode", label: "PIN code", value: profile?.pinCode ?? "" },
  ];
}

function DetailList({
  items,
  copiedField,
  onCopy,
}: {
  items: { name: string; label: string; value: string }[];
  copiedField?: string | null;
  onCopy?: (name: string, value: string) => Promise<void>;
}) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border">
      {items.map((item) => (
        <div key={item.name} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className={item.value ? "mt-1 break-words font-medium" : "mt-1 text-muted-foreground"}>{item.value || "Not recorded"}</dd>
          </div>
          {onCopy ? (
            <Button type="button" variant="outline" size="sm" disabled={!item.value} onClick={() => void onCopy(item.name, item.value)}>
              {copiedField === item.name ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

function Field({
  name,
  label,
  defaultValue,
  inputMode,
  autoComplete,
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.ceil(value / 1024)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
