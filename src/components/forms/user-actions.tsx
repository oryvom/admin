"use client";

import { useState } from "react";
import { changeRoleAction, setStatusAction } from "@/features/users/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function UserActions({
  userId,
  name,
  roleKey,
  status,
  roles,
  canChangeRole,
  canSuspend,
}: {
  userId: string;
  name: string;
  roleKey: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  roles: { key: string; name: string }[];
  canChangeRole: boolean;
  canSuspend: boolean;
}) {
  const [nextRole, setNextRole] = useState(roles.find((role) => role.key !== roleKey)?.key ?? roleKey);
  const [pending, setPending] = useState<"role" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function confirmRole() {
    setError(null);
    const result = await changeRoleAction({ userId, roleKey: nextRole });
    setPending(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setMessage("Role updated.");
  }

  async function confirmStatus() {
    setError(null);
    const nextStatus = status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const result = await setStatusAction({ userId, status: nextStatus });
    setPending(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setMessage(nextStatus === "SUSPENDED" ? "Account suspended." : "Account reactivated.");
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">Account actions</h2>
      {canChangeRole ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="next-role">
            New role
          </label>
          <select
            id="next-role"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={nextRole}
            onChange={(event) => setNextRole(event.target.value)}
          >
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => setPending("role")}>
            Change role
          </Button>
        </div>
      ) : null}
      {canSuspend && status !== "DISABLED" ? (
        <Button type="button" variant={status === "ACTIVE" ? "destructive" : "secondary"} onClick={() => setPending("status")}>
          {status === "SUSPENDED" ? "Reactivate account" : "Suspend account"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending === "role" ? "Change this role?" : status === "SUSPENDED" ? "Reactivate this account?" : "Suspend this account?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "role"
                ? `${name} will move to the ${nextRole} role and their sessions will be revoked.`
                : status === "SUSPENDED"
                  ? `${name} will be able to sign in again.`
                  : `${name} will be signed out and unable to sign in until the account is reactivated.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pending === "role") {
                  void confirmRole();
                } else {
                  void confirmStatus();
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
