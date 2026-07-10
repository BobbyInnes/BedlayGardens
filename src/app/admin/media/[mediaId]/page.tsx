import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { MediaEditForm } from "@/components/admin/media-edit-form"

export const metadata: Metadata = {
  title: "Edit Media | Admin",
}

export default async function EditMediaPage({
  params,
}: {
  params: Promise<{ mediaId: string }>
}) {
  const { mediaId } = await params
  const media = await prisma.mediaItem.findUnique({ where: { id: mediaId } })
  if (!media) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit media</h1>
      <MediaEditForm media={media} />
    </div>
  )
}
