"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { isTestModeEnvAllowed, TEST_MODE_SETTING_KEY } from "@/lib/test-mode"

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN" || !session.user.isSuperAdmin) {
    throw new Error("Only a super admin can change test mode.")
  }
  return session
}

export async function setTestMode(enabled: boolean): Promise<void> {
  const session = await requireSuperAdmin()
  if (enabled && !isTestModeEnvAllowed()) {
    throw new Error("Test mode isn't available in this environment (ALLOW_TEST_MODE isn't set).")
  }

  await prisma.setting.upsert({
    where: { key: TEST_MODE_SETTING_KEY },
    update: { value: String(enabled) },
    create: { key: TEST_MODE_SETTING_KEY, value: String(enabled) },
  })
  await logAudit({
    actorId: session.user.id,
    action: enabled ? "ENABLE_TEST_MODE" : "DISABLE_TEST_MODE",
    entity: "Setting",
    entityId: TEST_MODE_SETTING_KEY,
    meta: enabled
      ? "Test mode turned ON — new dogs auto-bypass vaccination/meet-greet checks, all outgoing email redirected to the business address"
      : "Test mode turned OFF",
  })

  revalidatePath("/admin", "layout")
}
