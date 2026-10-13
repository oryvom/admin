import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { visibleNavigation } from "@/features/navigation/items";
import { requireUser } from "@/server/auth/current-user";

export const instant = false;

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Skeleton className="min-h-screen" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      pages={visibleNavigation(user.permissions)}
      profile={{ name: user.name, email: user.email, roleName: user.roleName }}
    >
      {children}
    </AppShell>
  );
}
