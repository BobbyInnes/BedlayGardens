import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { CertificateUploader } from "@/components/portal/certificate-uploader"

export const metadata: Metadata = {
  title: "Upload Vaccination Certificate",
}

export default async function UploadVaccinationPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string }>
}) {
  const { dogId } = await searchParams
  const session = await auth()

  const dog = dogId ? await prisma.dog.findUnique({ where: { id: dogId } }) : null
  if (!dog || dog.ownerId !== session!.user.id) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Upload certificates for {dog.name}
      </h1>
      <CertificateUploader dogId={dog.id} />
    </div>
  )
}
