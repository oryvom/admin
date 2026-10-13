import type { AuditOutcome } from "@/lib/db/constants";
import type { DbClient } from "@/lib/db/executor";
import { auditLogs } from "@/lib/db/schema";
import { sanitizeAuditMetadata, type AuditMetadata } from "@/lib/security/audit-metadata";

export async function insertAuditLog(
  db: DbClient,
  input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    requestId: string | null;
    metadata?: Record<string, unknown>;
    outcome: AuditOutcome;
  },
): Promise<void> {
  const metadata: AuditMetadata = sanitizeAuditMetadata(input.metadata ?? {});
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    requestId: input.requestId,
    metadata,
    outcome: input.outcome,
  });
}
