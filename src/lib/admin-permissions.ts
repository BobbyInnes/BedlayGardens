import { prisma } from "@/lib/prisma"
import type { Session } from "next-auth"

export const MAX_SUPER_ADMINS = 2

/**
 * True if this admin is allowed to create, edit, deactivate, reset the
 * password of, or promote/demote other admin accounts.
 *
 * Normal path: they're already a super admin.
 * Bootstrap path: no super admin exists anywhere in the system yet, so the
 * very first admin to act is allowed to create/promote one. This closes
 * itself automatically the moment any super admin exists.
 */
export async function canManageAdmins(session: Session): Promise<boolean> {
  if (session.user.isSuperAdmin) return true
  const superAdminCount = await prisma.user.count({ where: { isSuperAdmin: true } })
  return superAdminCount === 0
}

/** There can be at most MAX_SUPER_ADMINS accounts flagged as super admin at once. */
export async function superAdminSlotAvailable(excludingUserId?: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { isSuperAdmin: true, ...(excludingUserId ? { NOT: { id: excludingUserId } } : {}) },
  })
  return count < MAX_SUPER_ADMINS
}
