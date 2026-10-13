import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaForm } from "@/components/forms/mfa-form";
import { presentedMfaToken } from "@/server/http/request";

export const metadata: Metadata = { title: "Verify sign-in" };
export const instant = false;

export default async function MfaPage() {
  const challenge = await presentedMfaToken();
  if (!challenge) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <p className="text-xs tracking-[0.18em] text-primary">ORYVOM</p>
          <h1 className="text-2xl font-semibold">Verify sign-in</h1>
          <p className="text-sm text-muted-foreground">
            Enter the code from your authenticator app, or one unused recovery code.
          </p>
        </div>
        <MfaForm />
      </div>
    </div>
  );
}
