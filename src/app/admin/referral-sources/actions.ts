"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

export type ReferralSourceActionState = { status: "idle" | "error"; message?: string }

const MAX_NAME_LENGTH = 60

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

function validateName(raw: string): { name: string } | { error: string } {
  const name = raw.trim().replace(/\s+/g, " ")
  if (!name) return { error: "Enter an option name." }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Option names can be at most ${MAX_NAME_LENGTH} characters.` }
  }
  return { name }
}

// Names are unique ignoring case, so the dropdown never shows near-duplicates.
async function nameTaken(name: string, exceptId?: string) {
  const existing = await prisma.referralSource.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
  })
  return existing !== null
}

function revalidateReferralPages() {
  revalidatePath("/admin/referral-sources")
  revalidatePath("/register")
  revalidatePath("/admin/customers", "layout")
}

export async function createReferralSource(rawName: string): Promise<ReferralSourceActionState> {
  const session = await requireAdmin()
  const parsed = validateName(rawName)
  if ("error" in parsed) return { status: "error", message: parsed.error }
  if (await nameTaken(parsed.name)) {
    return { status: "error", message: "An option with that name already exists." }
  }

  // New options go to the bottom of the list.
  const last = await prisma.referralSource.findFirst({ orderBy: { sortOrder: "desc" } })
  const source = await prisma.referralSource.create({
    data: { name: parsed.name, sortOrder: (last?.sortOrder ?? 0) + 1 },
  })

  await logAudit({
    actorId: session.user.id,
    action: "CREATE_REFERRAL_SOURCE",
    entity: "ReferralSource",
    entityId: source.id,
    meta: source.name,
  })
  revalidateReferralPages()
  return { status: "idle" }
}

export async function renameReferralSource(
  sourceId: string,
  rawName: string
): Promise<ReferralSourceActionState> {
  const session = await requireAdmin()
  const parsed = validateName(rawName)
  if ("error" in parsed) return { status: "error", message: parsed.error }
  if (await nameTaken(parsed.name, sourceId)) {
    return { status: "error", message: "An option with that name already exists." }
  }

  const before = await prisma.referralSource.findUniqueOrThrow({ where: { id: sourceId } })
  await prisma.referralSource.update({ where: { id: sourceId }, data: { name: parsed.name } })

  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_REFERRAL_SOURCE",
    entity: "ReferralSource",
    entityId: sourceId,
    meta: `${before.name} → ${parsed.name}`,
  })
  revalidateReferralPages()
  return { status: "idle" }
}

export async function setReferralSourceActive(
  sourceId: string,
  active: boolean
): Promise<ReferralSourceActionState> {
  const session = await requireAdmin()

  const source = await prisma.referralSource.update({ where: { id: sourceId }, data: { active } })

  await logAudit({
    actorId: session.user.id,
    action: `${active ? "ACTIVATE" : "DEACTIVATE"}_REFERRAL_SOURCE`,
    entity: "ReferralSource",
    entityId: sourceId,
    meta: source.name,
  })
  revalidateReferralPages()
  return { status: "idle" }
}

// Swaps this option's position with its neighbour in the list.
export async function moveReferralSource(
  sourceId: string,
  direction: "up" | "down"
): Promise<ReferralSourceActionState> {
  await requireAdmin()

  const all = await prisma.referralSource.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  const index = all.findIndex((s) => s.id === sourceId)
  const swapWith = direction === "up" ? index - 1 : index + 1
  if (index === -1 || swapWith < 0 || swapWith >= all.length) return { status: "idle" }

  // Renumber the whole list rather than swapping two values, so options that
  // happen to share a sortOrder still end up in a strict, stable order.
  const reordered = [...all]
  ;[reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]]
  await prisma.$transaction(
    reordered.map((s, i) =>
      prisma.referralSource.update({ where: { id: s.id }, data: { sortOrder: i + 1 } })
    )
  )

  revalidateReferralPages()
  return { status: "idle" }
}

// Only unused options can be deleted — once customers have chosen one it can
// only be deactivated, so their answers are never lost.
export async function deleteReferralSource(sourceId: string): Promise<ReferralSourceActionState> {
  const session = await requireAdmin()

  const source = await prisma.referralSource.findUnique({
    where: { id: sourceId },
    include: { _count: { select: { customers: true } } },
  })
  if (!source) return { status: "error", message: "Option not found." }
  if (source._count.customers > 0) {
    return {
      status: "error",
      message: "Customers have chosen this option, so it can't be deleted. Deactivate it instead.",
    }
  }

  await prisma.referralSource.delete({ where: { id: sourceId } })

  await logAudit({
    actorId: session.user.id,
    action: "DELETE_REFERRAL_SOURCE",
    entity: "ReferralSource",
    entityId: sourceId,
    meta: source.name,
  })
  revalidateReferralPages()
  return { status: "idle" }
}
