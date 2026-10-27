"use client";

import Link from "next/link";
import { Building2Icon, TruckIcon, UsersIcon } from "lucide-react";
import { useState } from "react";
import type { DashboardCardModel, DashboardIcon } from "@/features/dashboard/sections";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const icons: Record<DashboardIcon, typeof UsersIcon> = {
  users: UsersIcon,
  building: Building2Icon,
  truck: TruckIcon,
};

export function SectionGrid({ sections }: { sections: DashboardCardModel[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = sections.find((section) => section.id === activeId) ?? null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = icons[section.icon];
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveId(section.id)}
              className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>
      <Dialog open={active !== null} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {active?.links.map((link) => (
              <Button key={link.href} variant="outline" className="h-auto justify-start px-4 py-3" asChild>
                <Link href={link.href}>
                  <span>
                    <span className="block font-medium">{link.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{link.description}</span>
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
