import type { ReactNode } from "react";
import { PageSearch } from "@/components/layout/page-search";
import { UserMenu } from "@/components/layout/user-menu";
import type { SearchablePage } from "@/lib/search/page-search";

export function AppShell({
  pages,
  profile,
  children,
}: {
  pages: SearchablePage[];
  profile: { name: string; email: string; roleName: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="flex items-center gap-4 border-b border-border px-4 py-3 md:px-8">
        <p className="shrink-0 text-sm font-semibold">ORYVOM admin panel</p>
        <div className="mx-auto w-full min-w-0 max-w-xl flex-1">
          <PageSearch pages={pages} />
        </div>
        <UserMenu name={profile.name} email={profile.email} roleName={profile.roleName} />
      </header>
      <main id="main-content" className="px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
