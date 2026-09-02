import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { VaccinationManualForm } from "@/components/portal/vaccination-manual-form"

export const metadata: Metadata = {
  title: "Add Other Vaccine",
}

export default async function NewOtherVaccinationPage({
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
        Add other vaccine for {dog.name}
      </h1>
      <VaccinationManualForm dogId={dog.id} mode="other" />
    </div>
  )
}
