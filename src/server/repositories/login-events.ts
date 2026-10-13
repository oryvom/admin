import type { EventOutcome, FailureCode, LoginEventType } from "@/lib/db/constants";
import type { DbClient } from "@/lib/db/executor";
import { loginEvents } from "@/lib/db/schema";

export async function insertLoginEvent(
  db: DbClient,
  input: {
    userId: string | null;
    email: string | null;
    eventType: LoginEventType;
    outcome: EventOutcome;
    failureCode?: FailureCode | null;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string;
  },
): Promise<void> {
  await db.insert(loginEvents).values({
    userId: input.userId,
    email: input.email,
    eventType: input.eventType,
    outcome: input.outcome,
    failureCode: input.failureCode ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
  });
}
