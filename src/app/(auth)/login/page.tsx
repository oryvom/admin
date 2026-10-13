import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/login-form";
import { brand } from "@/lib/config/brand";
import { safeInternalPath } from "@/lib/security/redirect";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Sign in" };
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar px-10 py-12 text-sidebar-foreground lg:flex">
        <div>
          <p className="text-xs tracking-[0.22em] text-sidebar-primary">ORYVOM</p>
          <h1 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">{brand.companyName}</h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-sidebar-foreground/80">
          Administration portal for accounts, company data, and access control.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 lg:hidden">
            <p className="text-xs tracking-[0.18em] text-primary">ORYVOM</p>
            <p className="text-sm text-muted-foreground">{brand.companyName}</p>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">Enter your email or phone number. We will send a sign-in code to the account email.</p>
          </div>
          {params.expired ? (
            <p className="text-sm text-muted-foreground">Your session has ended. Sign in again to continue.</p>
          ) : null}
          <LoginForm nextPath={nextPath} />
        </div>
      </section>
    </div>
  );
}
