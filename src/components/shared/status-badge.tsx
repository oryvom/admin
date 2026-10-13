import type { AccountStatus } from "@/lib/db/constants";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: AccountStatus }) {
  if (status === "ACTIVE") {
    return <Badge>Active</Badge>;
  }
  if (status === "SUSPENDED") {
    return <Badge variant="destructive">Suspended</Badge>;
  }
  return <Badge variant="outline">Disabled</Badge>;
}
