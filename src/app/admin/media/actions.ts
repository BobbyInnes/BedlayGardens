"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { savePublicUpload, deletePublicUpload } from "@/lib/storage"
import { logAudit } from "@/lib/audit"

export type AdminActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

const mediaSchema = z.object({
  type: z.enum(["IMAGE", "VIDEO", "EMBED"]),
  usage: z.enum(["GALLERY", "HERO", "SERVICE", "ABOUT"]),
  caption: z.string().trim().max(200).optional().or(z.literal("")),
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  galleryCategoryId: z.string().trim().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  embedUrl: z.string().trim().max(1000).optional().or(z.literal("")),
})

// The gallery-category <Select> uses "none" for "uncategorized" — Radix
// doesn't allow an empty-string item value, so that sentinel needs mapping
// back to null before it reaches the database.
function normalizeGalleryCategoryId(value: string | undefined): string | null {
  return value && value !== "none" ? value : null
}

function revalidatePublicPaths() {
  revalidatePath("/gallery")
  revalidatePath("/")
  revalidatePath("/about")
  revalidatePath("/services")
}

export async function createMedia(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()

  const parsed = mediaSchema.safeParse({
    type: formData.get("type"),
    usage: formData.get("usage"),
    caption: formData.get("caption"),
    altText: formData.get("altText"),
    // Only one of these two inputs is actually rendered at a time (depending
    // on "Used on"), so the other is absent from the DOM entirely rather
    // than merely empty — formData.get returns null, not undefined, for a
    // missing field, which z.optional() alone doesn't accept.
    category: formData.get("category") ?? "",
    galleryCategoryId: formData.get("galleryCategoryId") ?? "",
    sortOrder: formData.get("sortOrder") || "0",
    embedUrl: formData.get("embedUrl") ?? "",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  let url: string
  if (parsed.data.type === "EMBED") {
    if (!parsed.data.embedUrl) {
      return { status: "error", message: "Enter an embed URL." }
    }
    url = parsed.data.embedUrl
  } else {
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Choose a file to upload." }
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    url = await savePublicUpload("media", file.name, buffer)
  }

  const media = await prisma.mediaItem.create({
    data: {
      type: parsed.data.type,
      usage: parsed.data.usage,
      url,
      caption: parsed.data.caption || null,
      altText: parsed.data.altText || null,
      category: parsed.data.category || null,
      galleryCategoryId: normalizeGalleryCategoryId(parsed.data.galleryCategoryId),
      sortOrder: parsed.data.sortOrder,
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPLOAD_MEDIA",
    entity: "MediaItem",
    entityId: media.id,
    meta: `${parsed.data.type} for ${parsed.data.usage}${parsed.data.caption ? ` — ${parsed.data.caption}` : ""}`,
  })

  revalidatePublicPaths()
  revalidatePath("/admin/media")
  redirect("/admin/media")
}

const mediaUpdateSchema = z.object({
  caption: z.string().trim().max(200).optional().or(z.literal("")),
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  galleryCategoryId: z.string().trim().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  usage: z.enum(["GALLERY", "HERO", "SERVICE", "ABOUT"]),
})

export async function updateMedia(
  mediaId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const existing = await prisma.mediaItem.findUnique({ where: { id: mediaId } })
  if (!existing) return { status: "error", message: "Media not found." }

  const parsed = mediaUpdateSchema.safeParse({
    caption: formData.get("caption"),
    altText: formData.get("altText"),
    category: formData.get("category") ?? "",
    galleryCategoryId: formData.get("galleryCategoryId") ?? "",
    sortOrder: formData.get("sortOrder") || "0",
    usage: formData.get("usage"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  let url = existing.url
  if (existing.type !== "EMBED") {
    const file = formData.get("file")
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const newUrl = await savePublicUpload("media", file.name, buffer)
      await deletePublicUpload(existing.url)
      url = newUrl
    }
  }

  await prisma.mediaItem.update({
    where: { id: mediaId },
    data: {
      url,
      caption: parsed.data.caption || null,
      altText: parsed.data.altText || null,
      category: parsed.data.category || null,
      galleryCategoryId: normalizeGalleryCategoryId(parsed.data.galleryCategoryId),
      sortOrder: parsed.data.sortOrder,
      usage: parsed.data.usage,
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_MEDIA",
    entity: "MediaItem",
    entityId: mediaId,
    meta: `${parsed.data.usage}${parsed.data.caption ? ` — ${parsed.data.caption}` : ""}${url !== existing.url ? " (file replaced)" : ""}`,
  })

  revalidatePublicPaths()
  revalidatePath("/admin/media")
  redirect("/admin/media")
}

export async function deleteMedia(mediaId: string) {
  const session = await requireAdmin()
  const media = await prisma.mediaItem.findUnique({ where: { id: mediaId } })
  if (!media) return

  if (media.type !== "EMBED") {
    await deletePublicUpload(media.url).catch(() => {})
  }
  await prisma.mediaItem.delete({ where: { id: mediaId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_MEDIA",
    entity: "MediaItem",
    entityId: mediaId,
    meta: `${media.usage}${media.caption ? ` — ${media.caption}` : ""}`,
  })

  revalidatePublicPaths()
  revalidatePath("/admin/media")
}

const galleryCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  sortOrder: z.coerce.number().int().default(0),
})

export async function createGalleryCategory(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = galleryCategorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || "0",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.galleryCategory.findUnique({ where: { name: parsed.data.name } })
  if (existing) {
    return { status: "error", message: "A category with this name already exists." }
  }

  const category = await prisma.galleryCategory.create({ data: parsed.data })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_GALLERY_CATEGORY",
    entity: "GalleryCategory",
    entityId: category.id,
    meta: category.name,
  })

  revalidatePath("/admin/media")
  revalidatePath("/gallery")
  return { status: "idle" }
}

export async function updateGalleryCategory(
  categoryId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const parsed = galleryCategorySchema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder") || "0",
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const existing = await prisma.galleryCategory.findFirst({
    where: { name: parsed.data.name, id: { not: categoryId } },
  })
  if (existing) {
    return { status: "error", message: "A category with this name already exists." }
  }

  const before = await prisma.galleryCategory.findUnique({ where: { id: categoryId } })
  await prisma.galleryCategory.update({ where: { id: categoryId }, data: parsed.data })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_GALLERY_CATEGORY",
    entity: "GalleryCategory",
    entityId: categoryId,
    meta: before && before.name !== parsed.data.name ? `${before.name} → ${parsed.data.name}` : parsed.data.name,
  })

  revalidatePath("/admin/media")
  revalidatePath("/gallery")
  return { status: "idle" }
}

// Media items in this category aren't deleted — they just fall back to
// "uncategorized" (MediaItem.galleryCategoryId -> SetNull), same as if the
// admin had never assigned one.
export async function deleteGalleryCategory(categoryId: string) {
  const session = await requireAdmin()
  const category = await prisma.galleryCategory.delete({ where: { id: categoryId } })
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_GALLERY_CATEGORY",
    entity: "GalleryCategory",
    entityId: categoryId,
    meta: category.name,
  })
  revalidatePath("/admin/media")
  revalidatePath("/gallery")
}
