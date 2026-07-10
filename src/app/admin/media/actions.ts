"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { savePublicUpload, deletePublicUpload } from "@/lib/storage"

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
  sortOrder: z.coerce.number().int().default(0),
  embedUrl: z.string().trim().max(1000).optional().or(z.literal("")),
})

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
  await requireAdmin()

  const parsed = mediaSchema.safeParse({
    type: formData.get("type"),
    usage: formData.get("usage"),
    caption: formData.get("caption"),
    altText: formData.get("altText"),
    category: formData.get("category"),
    sortOrder: formData.get("sortOrder") || "0",
    embedUrl: formData.get("embedUrl"),
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

  await prisma.mediaItem.create({
    data: {
      type: parsed.data.type,
      usage: parsed.data.usage,
      url,
      caption: parsed.data.caption || null,
      altText: parsed.data.altText || null,
      category: parsed.data.category || null,
      sortOrder: parsed.data.sortOrder,
    },
  })

  revalidatePublicPaths()
  revalidatePath("/admin/media")
  redirect("/admin/media")
}

const mediaUpdateSchema = z.object({
  caption: z.string().trim().max(200).optional().or(z.literal("")),
  altText: z.string().trim().max(200).optional().or(z.literal("")),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  usage: z.enum(["GALLERY", "HERO", "SERVICE", "ABOUT"]),
})

export async function updateMedia(
  mediaId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdmin()
  const existing = await prisma.mediaItem.findUnique({ where: { id: mediaId } })
  if (!existing) return { status: "error", message: "Media not found." }

  const parsed = mediaUpdateSchema.safeParse({
    caption: formData.get("caption"),
    altText: formData.get("altText"),
    category: formData.get("category"),
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
      sortOrder: parsed.data.sortOrder,
      usage: parsed.data.usage,
    },
  })

  revalidatePublicPaths()
  revalidatePath("/admin/media")
  redirect("/admin/media")
}

export async function deleteMedia(mediaId: string) {
  await requireAdmin()
  const media = await prisma.mediaItem.findUnique({ where: { id: mediaId } })
  if (!media) return

  if (media.type !== "EMBED") {
    await deletePublicUpload(media.url).catch(() => {})
  }
  await prisma.mediaItem.delete({ where: { id: mediaId } })

  revalidatePublicPaths()
  revalidatePath("/admin/media")
}
