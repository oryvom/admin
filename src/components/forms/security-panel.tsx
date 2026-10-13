"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { confirmEnrollmentAction, disableMfaAction, startEnrollmentAction } from "@/features/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SecurityPanel({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [pending, setPending] = useState(false);

  async function start() {
    setError(null);
    setPending(true);
    const result = await startEnrollmentAction();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setQrDataUrl(result.qrDataUrl ?? null);
    setManualKey(result.manualKey ?? null);
  }

  async function confirm() {
    setError(null);
    setPending(true);
    const result = await confirmEnrollmentAction({ code });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRecoveryCodes(result.recoveryCodes ?? []);
    setQrDataUrl(null);
    setManualKey(null);
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await disableMfaAction({ code: disableCode });
    setPending(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-medium">Save these recovery codes</h2>
        <p className="text-sm text-muted-foreground">
          These codes are shown once. Store them somewhere safe. Each code can be used a single time if you lose the authenticator.
        </p>
        <ul className="grid gap-2 font-mono text-sm sm:grid-cols-2">
          {recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode} className="rounded-md bg-muted px-3 py-2">
              {recoveryCode}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mfaEnabled ? (
        <form className="max-w-md space-y-3 rounded-xl border border-border bg-card p-5" onSubmit={disable}>
          <h2 className="text-lg font-medium">Disable multi-factor authentication</h2>
          <p className="text-sm text-muted-foreground">
            This signs you out and removes the authenticator and unused recovery codes.
          </p>
          <div className="space-y-2">
            <Label htmlFor="disable-code">Authentication code</Label>
            <Input id="disable-code" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(event) => setDisableCode(event.target.value)} />
          </div>
          <Button type="submit" variant="destructive" disabled={pending}>
            Disable MFA
          </Button>
        </form>
      ) : (
        <div className="max-w-md space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-medium">Set up an authenticator</h2>
          <p className="text-sm text-muted-foreground">
            Scan the code with an authenticator app, then enter the 6-digit code to finish enrollment.
          </p>
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt="Authenticator QR code"
              width={176}
              height={176}
              unoptimized
              className="rounded-md border border-border bg-white p-2"
            />
          ) : null}
          {manualKey ? <p className="font-mono text-sm">Manual key: {manualKey}</p> : null}
          {qrDataUrl ? (
            <div className="space-y-2">
              <Label htmlFor="enroll-code">Authentication code</Label>
              <Input id="enroll-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />
              <Button type="button" onClick={() => void confirm()} disabled={pending}>
                Confirm enrollment
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={() => void start()} disabled={pending}>
              Start enrollment
            </Button>
          )}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
