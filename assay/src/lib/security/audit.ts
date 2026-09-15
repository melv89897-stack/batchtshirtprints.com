import { db } from "@/lib/db";

/**
 * Append-only audit log. Every money movement, document access, and
 * permission change gets written here — never updated, never deleted.
 */
export async function audit(entry: {
  action: string;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId ?? null,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
