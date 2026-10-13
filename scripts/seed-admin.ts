import { stderr } from "node:process";
import { inspectInitialAdmin, provisionInitialAdmin } from "@/server/services/bootstrap-service";
import { closeDb } from "@/lib/db/client";
import { logSafeError } from "@/lib/security/log";

async function main(): Promise<void> {
  const inspection = await inspectInitialAdmin();
  if (inspection.status === "already_provisioned") {
    printAccount("Super Admin already provisioned. No changes were made.", inspection);
    return;
  }
  if (inspection.status === "stopped") {
    stderr.write(`${inspection.reason}\n`);
    if (inspection.existingRole || inspection.existingStatus) {
      stderr.write(`Existing role: ${inspection.existingRole ?? "unknown"}\n`);
      stderr.write(`Existing status: ${inspection.existingStatus ?? "unknown"}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const result = await provisionInitialAdmin();
  if (result.status === "stopped" || result.status === "absent") {
    stderr.write(`${result.status === "stopped" ? result.reason : "The administrator was not created."}\n`);
    process.exitCode = 1;
    return;
  }
  printAccount(result.status === "created" ? "Super Admin created." : "Super Admin already provisioned. No changes were made.", result);
}

function publicCliMessage(error: unknown): string {
  if (
    !(error instanceof Error) ||
    error.message.includes("://") ||
    error.message.includes("@") ||
    /postgres/i.test(error.message)
  ) {
    return "Bootstrap failed.";
  }
  return error.message;
}

function printAccount(
  heading: string,
  account: { id: string; email: string; role: string; accountStatus: string },
): void {
  process.stdout.write(`${heading}\n`);
  process.stdout.write(`id: ${account.id}\n`);
  process.stdout.write(`email: ${account.email}\n`);
  process.stdout.write(`role: ${account.role}\n`);
  process.stdout.write(`status: ${account.accountStatus}\n`);
}

main()
  .catch((error: unknown) => {
    logSafeError("admin bootstrap failed", error);
    stderr.write(`${publicCliMessage(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
