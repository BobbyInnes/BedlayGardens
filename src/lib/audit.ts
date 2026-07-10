import { prisma } from "@/lib/prisma"

export async function logAudit(options: {
  actorId: string
  action: string
  entity: string
  entityId: string
  meta?: string
}) {
  await prisma.auditLog.create({
    data: {
      actorId: options.actorId,
      action: options.action,
      entity: options.entity,
      entityId: options.entityId,
      meta: options.meta ?? null,
    },
  })
}
