"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit, logEntityChange } from "@/lib/audit"
import { saveUpload, deleteUpload } from "@/lib/storage"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { dogAddedEmail, dogUpdatedEmail } from "@/lib/email-templates"

const MAX_DOG_AGE_YEARS = 15
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
  allergies: z.string().trim().max(2000).optional(),
  medicalHistorySummary: z.string().trim().max(2000).optional(),
  microchipNumber: z.string().trim().max(50).optional(),
  color: z.string().trim().max(100).optional(),
  // runType, temperament, and groupPlayApproved are deliberately not
  // accepted here — they're kennel-assessed fields set by admin staff (see
  // admin/customers/actions.ts), not something a customer submits.
})

export type DogFieldValues = {
  name: string
  breed: string
  dob: string
  sex: string
  size: string
  neutered: boolean
  weightKg: string
  feedingNotes: string
  medicationNotes: string
  behaviourNotes: string
  allergies: string
  medicalHistorySummary: string
  microchipNumber: string
  color: string
}

export type DogFormState = {
  status: "idle" | "error"
  message?: string
  fieldErrors?: Record<string, string>
  // Echoed back on error so a failed submission refills the form instead of
  // blanking it (React resets uncontrolled <form> fields after any action).
  values?: DogFieldValues
}

function extractDogFormValues(formData: FormData): DogFieldValues {
  return {
    name: String(formData.get("name") ?? ""),
    breed: String(formData.get("breed") ?? ""),
    dob: String(formData.get("dob") ?? ""),
    sex: String(formData.get("sex") ?? ""),
    size: String(formData.get("size") ?? ""),
    neutered: formData.get("neutered") === "on",
    weightKg: String(formData.get("weightKg") ?? ""),
    feedingNotes: String(formData.get("feedingNotes") ?? ""),
    medicationNotes: String(formData.get("medicationNotes") ?? ""),
    behaviourNotes: String(formData.get("behaviourNotes") ?? ""),
    allergies: String(formData.get("allergies") ?? ""),
    medicalHistorySummary: String(formData.get("medicalHistorySummary") ?? ""),
    microchipNumber: String(formData.get("microchipNumber") ?? ""),
    color: String(formData.get("color") ?? ""),
  }
}

async function readDogFields(formData: FormData) {
  const values = extractDogFormValues(formData)
  const parsed = dogSchema.safeParse({
    ...values,
    dob: values.dob || undefined,
    weightKg: values.weightKg || "",
  })
  return { parsed, values }
}

type MedicationRowInput = {
  name: string
  amount: string | null
  am: boolean
  noon: boolean
  pm: boolean
  specificTime: string | null
  sortOrder: number
}

// Medical history rows are submitted as indexed fields (med-name-0, med-amount-0, …)
// rather than a JSON blob, following the form's existing plain-FormData conventions.
// AM, noon, PM, and a specific time are independent peer inputs — the time field is
// only present in the DOM (and thus submitted) when its "Specific time" checkbox is on.
function extractMedicationRows(formData: FormData): MedicationRowInput[] {
  const count = Number(formData.get("med-count") ?? 0)
  const rows: MedicationRowInput[] = []
  for (let i = 0; i < count; i++) {
    const name = String(formData.get(`med-name-${i}`) ?? "").trim()
    if (!name) continue
    const amount = String(formData.get(`med-amount-${i}`) ?? "").trim()
    const specificTime = String(formData.get(`med-time-${i}`) ?? "").trim()
    rows.push({
      name: name.slice(0, 200),
      amount: amount ? amount.slice(0, 100) : null,
      am: formData.get(`med-am-${i}`) === "on",
      noon: formData.get(`med-noon-${i}`) === "on",
      pm: formData.get(`med-pm-${i}`) === "on",
      specificTime: specificTime ? specificTime.slice(0, 10) : null,
      sortOrder: rows.length,
    })
  }
  return rows
}

type FeedingRowInput = {
  item: string
  amount: string | null
  am: boolean
  pm: boolean
  specificTime: string | null
  sortOrder: number
}

// Feeding rows follow the exact same indexed-field convention as medication
// rows above (feed-item-0, feed-amount-0, …), including AM/PM/specific-time
// being independent peer inputs.
function extractFeedingRows(formData: FormData): FeedingRowInput[] {
  const count = Number(formData.get("feed-count") ?? 0)
  const rows: FeedingRowInput[] = []
  for (let i = 0; i < count; i++) {
    const item = String(formData.get(`feed-item-${i}`) ?? "").trim()
    if (!item) continue
    const amount = String(formData.get(`feed-amount-${i}`) ?? "").trim()
    const specificTime = String(formData.get(`feed-time-${i}`) ?? "").trim()
    rows.push({
      item: item.slice(0, 200),
      amount: amount ? amount.slice(0, 100) : null,
      am: formData.get(`feed-am-${i}`) === "on",
      pm: formData.get(`feed-pm-${i}`) === "on",
      specificTime: specificTime ? specificTime.slice(0, 10) : null,
      sortOrder: rows.length,
    })
  }
  return rows
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
  const { parsed, values } = await readDogFields(formData)

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below.", values }
  }

  const data = parsed.data
  const medicationRows = extractMedicationRows(formData)
  const feedingRows = extractFeedingRows(formData)
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
      allergies: data.allergies || null,
      medicalHistorySummary: data.medicalHistorySummary || null,
      microchipNumber: data.microchipNumber || null,
      color: data.color || null,
      medications: medicationRows.length > 0 ? { create: medicationRows } : undefined,
      feedingItems: feedingRows.length > 0 ? { create: feedingRows } : undefined,
    },
    include: { medications: true, feedingItems: true },
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
    return { status: "error", message: "Dog not found.", values: extractDogFormValues(formData) }
  }

  const { parsed, values } = await readDogFields(formData)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message
    }
    return { status: "error", fieldErrors, message: "Please fix the errors below.", values }
  }

  const data = parsed.data
  const medicationRows = extractMedicationRows(formData)
  const feedingRows = extractFeedingRows(formData)
  let photoUrl = dog.photoUrl
  const photo = formData.get("photo")
  if (photo instanceof File && photo.size > 0) {
    if (photoUrl) {
      await deleteUpload(photoUrl).catch(() => {})
    }
    const buffer = Buffer.from(await photo.arrayBuffer())
    photoUrl = await saveUpload(`dogs/${dog.id}`, photo.name, buffer)
  }

  const after = {
    name: data.name,
    breed: data.breed,
    dob: data.dob ? new Date(data.dob) : null,
    sex: data.sex || null,
    size: data.size || null,
    neutered: !!data.neutered,
    weightKg: data.weightKg === "" || data.weightKg === undefined ? null : data.weightKg,
    // feedingNotes and medicationNotes are no longer form fields (their free-text
    // boxes were removed in favour of the structured Feeding instructions / Medical
    // history lists) — preserve whatever's on record rather than silently wiping it
    // since the form can no longer submit them.
    feedingNotes: dog.feedingNotes,
    medicationNotes: dog.medicationNotes,
    behaviourNotes: data.behaviourNotes || null,
    allergies: data.allergies || null,
    medicalHistorySummary: data.medicalHistorySummary || null,
    microchipNumber: data.microchipNumber || null,
    color: data.color || null,
    photoUrl,
  }

  const updatedDog = await prisma.dog.update({
    where: { id: dogId },
    // Medical history is a full replace, not a diff against existing rows —
    // simplest correct approach for a variable-length, freely reordered list.
    data: {
      ...after,
      medications: {
        deleteMany: {},
        create: medicationRows,
      },
      feedingItems: {
        deleteMany: {},
        create: feedingRows,
      },
    },
    include: { medications: true, feedingItems: true },
  })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_DOG",
    entity: "Dog",
    entityId: updatedDog.id,
    context: `dog ${dog.name}, owner ${session.user.name ?? session.user.email}`,
    before: dog,
    after,
    labels: {
      name: "Name",
      breed: "Breed",
      dob: "Date of birth",
      sex: "Sex",
      size: "Size",
      neutered: "Neutered",
      weightKg: "Weight (kg)",
      feedingNotes: "Feeding notes",
      medicationNotes: "Medication notes",
      behaviourNotes: "Behaviour notes",
      allergies: "Allergies",
      medicalHistorySummary: "Medical history summary",
      microchipNumber: "Microchip number",
      color: "Colour",
      photoUrl: "Photo",
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

  await logAudit({
    actorId: session.user.id,
    action: "DELETE_DOG",
    entity: "Dog",
    entityId: dogId,
    meta: `${dog.name} (${dog.breed})`,
  })

  if (dog.photoUrl) {
    await deleteUpload(dog.photoUrl).catch(() => {})
  }

  revalidatePath("/portal/dogs")
  redirect("/portal/dogs")
}
