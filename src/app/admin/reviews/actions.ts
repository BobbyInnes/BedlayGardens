"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function moderateReview(reviewId: string, status: "APPROVED" | "REJECTED") {
  const session = await requireAdmin()
  await prisma.review.update({ where: { id: reviewId }, data: { status } })
  await logAudit({
    actorId: session.user.id,
    action: "MODERATE_REVIEW",
    entity: "Review",
    entityId: reviewId,
    meta: status,
  })
  revalidatePath("/admin/reviews")
  revalidatePath("/")
}
