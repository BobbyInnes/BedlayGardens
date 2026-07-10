"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function completeCareTask(taskId: string, notes: string) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }

  await prisma.careTask.update({
    where: { id: taskId },
    data: { completedById: session.user.id, completedAt: new Date(), notes: notes || null },
  })

  revalidatePath("/staff/care-schedule")
}
