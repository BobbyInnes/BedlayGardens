"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

export type TagActionState = { status: "idle" | "error"; message?: string }

export type TagKind = "customer" | "dog"

const MAX_TAG_NAME_LENGTH = 40

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

function validateName(raw: string): { name: string } | { error: string } {
  const name = raw.trim().replace(/\s+/g, " ")
  if (!name) return { error: "Enter a tag name." }
  if (name.length > MAX_TAG_NAME_LENGTH) {
    return { error: `Tag names can be at most ${MAX_TAG_NAME_LENGTH} characters.` }
  }
  return { name }
}

// Tag names are unique per list, ignoring case ("VIP" and "vip" would just
// confuse the dropdown).
async function nameTaken(kind: TagKind, name: string, exceptId?: string) {
  const where = {
    name: { equals: name, mode: "insensitive" as const },
    ...(exceptId ? { NOT: { id: exceptId } } : {}),
  }
  const existing =
    kind === "customer"
      ? await prisma.customerTag.findFirst({ where })
      : await prisma.dogTag.findFirst({ where })
  return existing !== null
}

function revalidateTagPages() {
  revalidatePath("/admin/tags")
  revalidatePath("/admin/customers", "layout")
  revalidatePath("/admin/dogs")
}

export async function createTag(kind: TagKind, rawName: string): Promise<TagActionState> {
  const session = await requireAdmin()
  const parsed = validateName(rawName)
  if ("error" in parsed) return { status: "error", message: parsed.error }
  if (await nameTaken(kind, parsed.name)) {
    return { status: "error", message: "A tag with that name already exists." }
  }

  const tag =
    kind === "customer"
      ? await prisma.customerTag.create({ data: { name: parsed.name } })
      : await prisma.dogTag.create({ data: { name: parsed.name } })

  await logAudit({
    actorId: session.user.id,
    action: kind === "customer" ? "CREATE_CUSTOMER_TAG" : "CREATE_DOG_TAG",
    entity: kind === "customer" ? "CustomerTag" : "DogTag",
    entityId: tag.id,
    meta: tag.name,
  })
  revalidateTagPages()
  return { status: "idle" }
}

export async function renameTag(
  kind: TagKind,
  tagId: string,
  rawName: string
): Promise<TagActionState> {
  const session = await requireAdmin()
  const parsed = validateName(rawName)
  if ("error" in parsed) return { status: "error", message: parsed.error }
  if (await nameTaken(kind, parsed.name, tagId)) {
    return { status: "error", message: "A tag with that name already exists." }
  }

  const before =
    kind === "customer"
      ? await prisma.customerTag.findUniqueOrThrow({ where: { id: tagId } })
      : await prisma.dogTag.findUniqueOrThrow({ where: { id: tagId } })

  if (kind === "customer") {
    await prisma.customerTag.update({ where: { id: tagId }, data: { name: parsed.name } })
  } else {
    await prisma.dogTag.update({ where: { id: tagId }, data: { name: parsed.name } })
  }

  await logAudit({
    actorId: session.user.id,
    action: kind === "customer" ? "RENAME_CUSTOMER_TAG" : "RENAME_DOG_TAG",
    entity: kind === "customer" ? "CustomerTag" : "DogTag",
    entityId: tagId,
    meta: `${before.name} → ${parsed.name}`,
  })
  revalidateTagPages()
  return { status: "idle" }
}

export async function setTagActive(
  kind: TagKind,
  tagId: string,
  active: boolean
): Promise<TagActionState> {
  const session = await requireAdmin()

  const tag =
    kind === "customer"
      ? await prisma.customerTag.update({ where: { id: tagId }, data: { active } })
      : await prisma.dogTag.update({ where: { id: tagId }, data: { active } })

  await logAudit({
    actorId: session.user.id,
    action: `${active ? "ACTIVATE" : "DEACTIVATE"}_${kind === "customer" ? "CUSTOMER" : "DOG"}_TAG`,
    entity: kind === "customer" ? "CustomerTag" : "DogTag",
    entityId: tagId,
    meta: tag.name,
  })
  revalidateTagPages()
  return { status: "idle" }
}

// Deleting a tag also removes it from every customer/dog it was applied to
// (cascade) — the confirmation dialog on the Tags page says so. Deactivating
// is the non-destructive alternative.
export async function deleteTag(kind: TagKind, tagId: string): Promise<TagActionState> {
  const session = await requireAdmin()

  const tag =
    kind === "customer"
      ? await prisma.customerTag.delete({ where: { id: tagId } })
      : await prisma.dogTag.delete({ where: { id: tagId } })

  await logAudit({
    actorId: session.user.id,
    action: kind === "customer" ? "DELETE_CUSTOMER_TAG" : "DELETE_DOG_TAG",
    entity: kind === "customer" ? "CustomerTag" : "DogTag",
    entityId: tagId,
    meta: tag.name,
  })
  revalidateTagPages()
  return { status: "idle" }
}

export async function assignCustomerTag(
  customerId: string,
  tagId: string
): Promise<TagActionState> {
  const session = await requireAdmin()

  const [customer, tag] = await Promise.all([
    prisma.user.findFirst({ where: { id: customerId, role: "CUSTOMER" } }),
    prisma.customerTag.findUnique({ where: { id: tagId } }),
  ])
  if (!customer) return { status: "error", message: "Customer not found." }
  if (!tag || !tag.active) return { status: "error", message: "That tag isn't available." }

  await prisma.customerTagAssignment.upsert({
    where: { customerId_tagId: { customerId, tagId } },
    create: { customerId, tagId },
    update: {},
  })

  await logAudit({
    actorId: session.user.id,
    action: "ADD_CUSTOMER_TAG",
    entity: "User",
    entityId: customerId,
    meta: tag.name,
  })
  revalidatePath(`/admin/customers/${customerId}`)
  revalidatePath("/admin/customers")
  return { status: "idle" }
}

export async function removeCustomerTag(
  customerId: string,
  tagId: string
): Promise<TagActionState> {
  const session = await requireAdmin()

  const tag = await prisma.customerTag.findUnique({ where: { id: tagId } })
  await prisma.customerTagAssignment.deleteMany({ where: { customerId, tagId } })

  await logAudit({
    actorId: session.user.id,
    action: "REMOVE_CUSTOMER_TAG",
    entity: "User",
    entityId: customerId,
    meta: tag?.name,
  })
  revalidatePath(`/admin/customers/${customerId}`)
  revalidatePath("/admin/customers")
  return { status: "idle" }
}

export async function assignDogTag(dogId: string, tagId: string): Promise<TagActionState> {
  const session = await requireAdmin()

  const [dog, tag] = await Promise.all([
    prisma.dog.findUnique({ where: { id: dogId } }),
    prisma.dogTag.findUnique({ where: { id: tagId } }),
  ])
  if (!dog) return { status: "error", message: "Dog not found." }
  if (!tag || !tag.active) return { status: "error", message: "That tag isn't available." }

  await prisma.dogTagAssignment.upsert({
    where: { dogId_tagId: { dogId, tagId } },
    create: { dogId, tagId },
    update: {},
  })

  await logAudit({
    actorId: session.user.id,
    action: "ADD_DOG_TAG",
    entity: "Dog",
    entityId: dogId,
    meta: tag.name,
  })
  revalidatePath(`/admin/customers/${dog.ownerId}`)
  revalidatePath("/admin/dogs")
  return { status: "idle" }
}

export async function removeDogTag(dogId: string, tagId: string): Promise<TagActionState> {
  const session = await requireAdmin()

  const [dog, tag] = await Promise.all([
    prisma.dog.findUnique({ where: { id: dogId } }),
    prisma.dogTag.findUnique({ where: { id: tagId } }),
  ])
  await prisma.dogTagAssignment.deleteMany({ where: { dogId, tagId } })

  await logAudit({
    actorId: session.user.id,
    action: "REMOVE_DOG_TAG",
    entity: "Dog",
    entityId: dogId,
    meta: tag?.name,
  })
  if (dog) revalidatePath(`/admin/customers/${dog.ownerId}`)
  revalidatePath("/admin/dogs")
  return { status: "idle" }
}
