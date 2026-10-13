import type { Metadata } from "next";
import Link from "next/link";
import { CreateUserDialog } from "@/components/forms/create-user-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE } from "@/lib/auth/cookies";
import { formatDate, formatDateTime } from "@/lib/format";
import { parsePage, parseSearchQuery } from "@/lib/validation/search";
import { hasPermission } from "@/server/policies/permissions";
import { requirePermission } from "@/server/auth/current-user";
import { getAssignableRoles, getUserPage } from "@/server/services/user-service";

export const metadata: Metadata = { title: "Users" };
export const instant = false;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const actor = await requirePermission("users.read");
  const params = await searchParams;
  const query = parseSearchQuery(params.q);
  const page = parsePage(params.page);
  const [{ users, total }, roles] = await Promise.all([
    getUserPage(query, page),
    hasPermission(actor.permissions, "users.create") ? getAssignableRoles(actor.permissions) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Accounts that can sign in to the administration portal."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Users" }]}
        action={hasPermission(actor.permissions, "users.create") ? <CreateUserDialog roles={roles} /> : null}
      />
      <form className="flex max-w-xl gap-2" action="/users">
        <label className="sr-only" htmlFor="user-search">
          Search users
        </label>
        <Input id="user-search" name="q" defaultValue={query} placeholder="Search name, email, or phone" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {users.length === 0 ? (
        <EmptyState
          title={query ? "No matching users" : "No user accounts yet"}
          description={
            query
              ? "No users match this search."
              : "No user accounts are available yet. The initial Super Admin appears here after the bootstrap command completes."
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link href={`/users/${user.id}`} className="font-medium underline-offset-4 hover:underline">
                      {user.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground" title={user.id}>
                      {user.id}
                    </p>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.roleName}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} query={query} />
    </div>
  );
}
