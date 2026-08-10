"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function requireStaffOrAdmin() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function createToDoTask(formData: FormData): Promise<void> {
  const session = await requireStaffOrAdmin()
  const text = String(formData.get("text") ?? "").trim()
  if (!text) return
  const assignedToId = (formData.get("assignedToId") as string | null) || null

  await prisma.toDoTask.create({
    data: { text, assignedToId, createdById: session.user.id },
  })

  revalidatePath("/admin")
}

export async function toggleToDoTask(taskId: string, completed: boolean): Promise<void> {
  await requireStaffOrAdmin()

  await prisma.toDoTask.update({
    where: { id: taskId },
    data: { completed, completedAt: completed ? new Date() : null },
  })

  revalidatePath("/admin")
}

export async function deleteToDoTask(taskId: string): Promise<void> {
  await requireStaffOrAdmin()

  await prisma.toDoTask.delete({ where: { id: taskId } })

  revalidatePath("/admin")
}
