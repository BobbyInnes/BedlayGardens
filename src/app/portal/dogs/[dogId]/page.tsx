import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DogForm } from "@/components/portal/dog-form"
import { updateDog } from "@/app/portal/dogs/actions"

export const metadata: Metadata = {
  title: "Edit Dog",
}

export default async function EditDogPage({
  params,
}: {
  params: Promise<{ dogId: string }>
}) {
  const { dogId } = await params
  const session = await auth()
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })

  if (!dog || dog.ownerId !== session!.user.id) {
    notFound()
  }

  const boundUpdateDog = updateDog.bind(null, dogId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {dog.name}</h1>
      <DogForm dog={dog} action={boundUpdateDog} submitLabel="Save changes" />
    </div>
  )
}
