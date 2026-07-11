"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveUpload } from "@/lib/storage"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { pupdateEmail } from "@/lib/email-templates"

export type StaffActionState = { status: "idle" | "error"; message?: string }

async function requireStaff() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "STAFF" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized")
  }
  return session
}

export async function createPupdate(
  _prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const session = await requireStaff()

  const dogAndBooking = formData.get("dogAndBooking") as string | null
  const [bookingId, dogId] = dogAndBooking?.split(":") ?? []
  const note = ((formData.get("note") as string | null) ?? "").trim()
  const file = formData.get("file")

  if (!bookingId || !dogId) {
    return { status: "error", message: "Choose a dog." }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a photo or video." }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, bookingDogs: { where: { dogId } } },
  })
  if (!booking || booking.bookingDogs.length === 0) {
    return { status: "error", message: "Booking or dog not found." }
  }

  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog) return { status: "error", message: "Dog not found." }

  const isVideo = file.type.startsWith("video/")
  const buffer = Buffer.from(await file.arrayBuffer())
  const key = await saveUpload(`pupdates/${dogId}`, file.name, buffer)

  const mediaItem = await prisma.mediaItem.create({
    data: { type: isVideo ? "VIDEO" : "IMAGE", url: key, usage: "PUPDATE" },
  })

  await prisma.pupdate.create({
    data: {
      bookingId,
      dogId,
      staffId: session.user.id,
      mediaItemId: mediaItem.id,
      note: note || null,
    },
  })

  const settings = await getSettings()
  const email = pupdateEmail(settings, dog.name, note || null)
  await sendEmail({ to: booking.customer.email, subject: email.subject, html: email.html })

  revalidatePath("/staff/pupdates")
  revalidatePath("/portal/pupdates")
  return { status: "idle", message: `Pupdate posted for ${dog.name}.` }
}
