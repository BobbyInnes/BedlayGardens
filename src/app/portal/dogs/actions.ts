"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveUpload, deleteUpload } from "@/lib/storage"

const dogSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  breed: z.string().trim().min(1, "Breed is required").max(200),
  dob: z.string().optional(),
  sex: z.enum(["male", "female", ""]).optional(),
  size: z.enum(["MINIATURE", "SMALL", "MEDIUM", "LARGE", "GIANT", ""]).optional(),
  neutered: z.coerce.boolean().optional(),
  weightKg: z.coerce.number().positive().optional().or(z.literal("")),
  feedingNotes: z.string().trim().max(2000).optional(),
  medicationNotes: z.string().trim().max(2000).optional(),
  behaviourNotes: z.string().trim().max(2000).optional(),
  vetName: z.string().trim().max(200).optional(),
  vetPhone: z.string().trim().max(50).optional(),
  emergencyContact: z.string().trim().max(200).optional(),
})

export type DogFormState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Record<string, string>
}

async function readDogFields(formData: FormData) {
  const parsed = dogSchema.safeParse({
    name: formData.get("name"),
    breed: formData.get("breed"),
    dob: formData.get("dob") || undefined,
    sex: (formData.get("sex") as string) || "",
    size: (formData.get("size") as string) || "",
    neutered: formData.get("neutered") === "on",
    weightKg: formData.get("weightKg") || "",
    feedingNotes: formData.get("feedingNotes") || "",
    medicationNotes: formData.get("medicationNotes") || "",
    behaviourNotes: formData.get("behaviourNotes") || "",
    vetName: formData.get("vetName") || "",
    vetPhone: formData.get("vetPhone") || "",
    emergencyContact: formData.get("emergencyContact") || "",
  })
  return parsed
}

async function requireOwnerSession() {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

export async function createDog(
  _prevState: DogFormState,
  formData: FormData
): Promise<DogFormState> {
  const session = await requireOwnerSession()
  const parsed = await readDogFields(formData)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  const data = parsed.data
  const dog = await prisma.dog.create({
    data: {
      ownerId: session.user.id,
      name: data.name,
      breed: data.breed,
      dob: data.dob ? new Date(data.dob) : null,
      sex: data.sex || null,
      size: data.size || null,
      neutered: !!data.neutered,
      weightKg: data.weightKg === "" || data.weightKg === undefined ? null : data.weightKg,
      feedingNotes: data.feedingNotes || null,
      medicationNotes: data.medicationNotes || null,
      behaviourNotes: data.behaviourNotes || null,
      vetName: data.vetName || null,
      vetPhone: data.vetPhone || null,
      emergencyContact: data.emergencyContact || null,
    },
  })

  const photo = formData.get("photo")
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer())
    const key = await saveUpload(`dogs/${dog.id}`, photo.name, buffer)
    await prisma.dog.update({ where: { id: dog.id }, data: { photoUrl: key } })
  }

  revalidatePath("/portal/dogs")
  redirect("/portal/dogs")
}

export async function updateDog(
  dogId: string,
  _prevState: DogFormState,
  formData: FormData
): Promise<DogFormState> {
  const session = await requireOwnerSession()
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) {
    return { status: "error", message: "Dog not found." }
  }

  const parsed = await readDogFields(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below." }
  }

  const data = parsed.data
  let photoUrl = dog.photoUrl
  const photo = formData.get("photo")
  if (photo instanceof File && photo.size > 0) {
    if (photoUrl) {
      await deleteUpload(photoUrl).catch(() => {})
    }
    const buffer = Buffer.from(await photo.arrayBuffer())
    photoUrl = await saveUpload(`dogs/${dog.id}`, photo.name, buffer)
  }

  await prisma.dog.update({
    where: { id: dogId },
    data: {
      name: data.name,
      breed: data.breed,
      dob: data.dob ? new Date(data.dob) : null,
      sex: data.sex || null,
      size: data.size || null,
      neutered: !!data.neutered,
      weightKg: data.weightKg === "" || data.weightKg === undefined ? null : data.weightKg,
      feedingNotes: data.feedingNotes || null,
      medicationNotes: data.medicationNotes || null,
      behaviourNotes: data.behaviourNotes || null,
      vetName: data.vetName || null,
      vetPhone: data.vetPhone || null,
      emergencyContact: data.emergencyContact || null,
      photoUrl,
    },
  })

  revalidatePath("/portal/dogs")
  revalidatePath(`/portal/dogs/${dogId}`)
  redirect("/portal/dogs")
}

export async function deleteDog(dogId: string) {
  const session = await requireOwnerSession()
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) {
    throw new Error("Dog not found")
  }
  if (dog.photoUrl) {
    await deleteUpload(dog.photoUrl).catch(() => {})
  }
  await prisma.dog.delete({ where: { id: dogId } })
  revalidatePath("/portal/dogs")
  redirect("/portal/dogs")
}
