"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { saveUpload, deleteUpload } from "@/lib/storage"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { dogAddedEmail, dogUpdatedEmail } from "@/lib/email-templates"

const MAX_DOG_AGE_YEARS = 18
const MAX_DOG_WEIGHT_KG = 200

const dogSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  breed: z.string().trim().min(1, "Breed is required").max(200),
  dob: z
    .string()
    .optional()
    .refine((value) => !value || new Date(value).getTime() <= Date.now(), {
      message: "Date of birth cannot be in the future",
    })
    .refine(
      (value) => {
        if (!value) return true
        const minDate = new Date()
        minDate.setFullYear(minDate.getFullYear() - MAX_DOG_AGE_YEARS)
        return new Date(value).getTime() >= minDate.getTime()
      },
      { message: `Date of birth cannot be more than ${MAX_DOG_AGE_YEARS} years ago` }
    ),
  sex: z.enum(["male", "female", ""]).optional(),
  size: z.enum(["MINIATURE", "SMALL", "MEDIUM", "LARGE", "GIANT", ""]).optional(),
  neutered: z.coerce.boolean().optional(),
  weightKg: z.coerce
    .number()
    .positive()
    .max(MAX_DOG_WEIGHT_KG, `Weight cannot exceed ${MAX_DOG_WEIGHT_KG}kg`)
    .optional()
    .or(z.literal("")),
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

  await logAudit({
    actorId: session.user.id,
    action: "CREATE_DOG",
    entity: "Dog",
    entityId: dog.id,
    meta: `${dog.name} (${dog.breed})`,
  })

  // A failed notification email must not fail the dog creation itself.
  try {
    if (session.user.email) {
      const settings = await getSettings()
      const email = dogAddedEmail(settings, dog)
      await sendEmail({ to: session.user.email, subject: email.subject, html: email.html })
    }
  } catch (error) {
    console.error("[dogs] failed to send dog-added email", error)
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

  const updatedDog = await prisma.dog.update({
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

  // A failed notification email must not fail the dog update itself.
  try {
    if (session.user.email) {
      const settings = await getSettings()
      const email = dogUpdatedEmail(settings, updatedDog)
      await sendEmail({ to: session.user.email, subject: email.subject, html: email.html })
    }
  } catch (error) {
    console.error("[dogs] failed to send dog-updated email", error)
  }

  revalidatePath("/portal/dogs")
  revalidatePath(`/portal/dogs/${dogId}`)
  redirect("/portal/dogs")
}

export type DeleteDogState = { status: "idle" | "error"; message?: string }

export async function deleteDog(
  dogId: string,
  _prevState: DeleteDogState,
  _formData: FormData
): Promise<DeleteDogState> {
  const session = await requireOwnerSession()
  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) {
    return { status: "error", message: "Dog not found." }
  }

  try {
    await prisma.dog.delete({ where: { id: dogId } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        status: "error",
        message:
          "This dog can't be deleted because it has booking history — contact us if you need it removed.",
      }
    }
    throw error
  }

  if (dog.photoUrl) {
    await deleteUpload(dog.photoUrl).catch(() => {})
  }

  revalidatePath("/portal/dogs")
  redirect("/portal/dogs")
}
