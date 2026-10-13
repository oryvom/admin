import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserActions } from "@/components/forms/user-actions";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/format";
import { hasPermission } from "@/server/policies/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { getAssignableRoles, getUserDetail } from "@/server/services/user-service";

export const metadata: Metadata = { title: "User" };
export const instant = false;

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const actor = await requirePermission("users.read");
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    notFound();
  }
  const user = await getUserDetail(userId);
  if (!user) {
    notFound();
  }
  const roles = hasPermission(actor.permissions, "users.change_role")
    ? await getAssignableRoles(actor.permissions)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        description={user.email}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Users", href: "/users" },
          { label: user.name },
        ]}
      />
      <dl className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
        <Detail label="User ID" value={user.id} mono />
        <Detail label="Phone" value={user.phone} />
        <Detail label="Role" value={user.roleName} />
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <StatusBadge status={user.status} />
          </dd>
        </div>
        <Detail label="Created" value={formatDateTime(user.createdAt)} />
        <Detail label="Last login" value={formatDateTime(user.lastLoginAt)} />
        <Detail label="MFA" value={user.mfaEnabled ? "Enabled" : "Not enabled"} />
      </dl>
      <UserActions
        userId={user.id}
        name={user.name}
        roleKey={user.roleKey}
        status={user.status}
        roles={roles}
        canChangeRole={hasPermission(actor.permissions, "users.change_role")}
        canSuspend={hasPermission(actor.permissions, "users.suspend")}
      />
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 break-all font-mono text-sm" : "mt-1 text-sm"}>{value}</dd>
    </div>
  );
}
