import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { KennelUnitEditForm } from "@/components/admin/kennel-unit-edit-form"

export const metadata: Metadata = {
  title: "Edit Accommodation Unit | Admin",
}

export default async function EditKennelUnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>
}) {
  const { unitId } = await params
  const unit = await prisma.kennelUnit.findUnique({ where: { id: unitId } })
  if (!unit) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {unit.name}</h1>
      <KennelUnitEditForm unit={unit} />
    </div>
  )
}
