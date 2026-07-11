"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function moderateReview(reviewId: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin()
  await prisma.review.update({ where: { id: reviewId }, data: { status } })
  revalidatePath("/admin/reviews")
  revalidatePath("/")
}
