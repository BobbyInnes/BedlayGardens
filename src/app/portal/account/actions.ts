"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Prisma, type NotificationChannel } from "@/generated/prisma/client"
import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { setOptOut } from "@/lib/notification-preferences"
import { logEntityChange } from "@/lib/audit"

export type ActionState = { status: "idle" | "success" | "error"; message?: string }

// The channel is echoed back on success so the UI can trust the action's own
// response as the source of truth, rather than depending on the page
// re-fetching fresh props after the mutation (which proved unreliable here).
export type NotificationActionState = ActionState & { channel?: NotificationChannel }

const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    workPhone: z.string().trim().max(50).optional().or(z.literal("")),
    addressLine1: z.string().trim().min(1, "Address line 1 is required").max(200),
    addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
    addressCity: z.string().trim().max(100).optional().or(z.literal("")),
    addressPostcode: z.string().trim().max(20).optional().or(z.literal("")),
  })
  .refine((data) => !!data.phone || !!data.workPhone, {
    message: "Enter a telephone number or a work phone number.",
    path: ["phone"],
  })

export async function updateProfile(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    workPhone: formData.get("workPhone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    addressCity: formData.get("addressCity"),
    addressPostcode: formData.get("addressPostcode"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const before = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  const after = {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    workPhone: parsed.data.workPhone || null,
    addressLine1: parsed.data.addressLine1,
    addressLine2: parsed.data.addressLine2 || null,
    addressCity: parsed.data.addressCity || null,
    addressPostcode: parsed.data.addressPostcode || null,
  }

  await prisma.user.update({ where: { id: session.user.id }, data: after })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_CUSTOMER_PROFILE",
    entity: "User",
    entityId: session.user.id,
    context: `customer ${before.name} <${before.email}> (self-service)`,
    before,
    after,
    labels: {
      name: "Name",
      phone: "Phone",
      workPhone: "Work phone",
      addressLine1: "Address line 1",
      addressLine2: "Address line 2",
      addressCity: "City",
      addressPostcode: "Postcode",
    },
  })

  revalidatePath("/portal/account")
  return { status: "success", message: "Details updated." }
}

const emergencyContactSchema = z.object({
  emergencyContactName: z.string().trim().max(200).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(50).optional().or(z.literal("")),
  emergencyContactAddressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  emergencyContactAddressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  emergencyContactCity: z.string().trim().max(100).optional().or(z.literal("")),
  emergencyContactPostcode: z.string().trim().max(20).optional().or(z.literal("")),
})

export async function updateEmergencyContact(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = emergencyContactSchema.safeParse({
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    emergencyContactAddressLine1: formData.get("emergencyContactAddressLine1"),
    emergencyContactAddressLine2: formData.get("emergencyContactAddressLine2"),
    emergencyContactCity: formData.get("emergencyContactCity"),
    emergencyContactPostcode: formData.get("emergencyContactPostcode"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const before = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  const after = {
    emergencyContactName: parsed.data.emergencyContactName || null,
    emergencyContactPhone: parsed.data.emergencyContactPhone || null,
    emergencyContactAddressLine1: parsed.data.emergencyContactAddressLine1 || null,
    emergencyContactAddressLine2: parsed.data.emergencyContactAddressLine2 || null,
    emergencyContactCity: parsed.data.emergencyContactCity || null,
    emergencyContactPostcode: parsed.data.emergencyContactPostcode || null,
  }

  await prisma.user.update({ where: { id: session.user.id }, data: after })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_EMERGENCY_CONTACT",
    entity: "User",
    entityId: session.user.id,
    context: `customer ${before.name} <${before.email}> (self-service)`,
    before,
    after,
    labels: {
      emergencyContactName: "Emergency contact name",
      emergencyContactPhone: "Emergency contact phone",
      emergencyContactAddressLine1: "Emergency contact address line 1",
      emergencyContactAddressLine2: "Emergency contact address line 2",
      emergencyContactCity: "Emergency contact town/city",
      emergencyContactPostcode: "Emergency contact postcode",
    },
  })

  revalidatePath("/portal/account")
  return { status: "success", message: "Emergency contact updated." }
}

const vetPracticeSchema = z.object({
  vetName: z.string().trim().max(200).optional().or(z.literal("")),
  vetPhone: z.string().trim().max(50).optional().or(z.literal("")),
  vetPracticeName: z.string().trim().max(200).optional().or(z.literal("")),
  vetAddressLine1: z.string().trim().max(200).optional().or(z.literal("")),
  vetAddressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  vetCity: z.string().trim().max(100).optional().or(z.literal("")),
  vetPostcode: z.string().trim().max(20).optional().or(z.literal("")),
  vetEmail: z.string().trim().max(200).email("Enter a valid email").optional().or(z.literal("")),
})

export async function updateVetPractice(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = vetPracticeSchema.safeParse({
    vetName: formData.get("vetName"),
    vetPhone: formData.get("vetPhone"),
    vetPracticeName: formData.get("vetPracticeName"),
    vetAddressLine1: formData.get("vetAddressLine1"),
    vetAddressLine2: formData.get("vetAddressLine2"),
    vetCity: formData.get("vetCity"),
    vetPostcode: formData.get("vetPostcode"),
    vetEmail: formData.get("vetEmail"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const before = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  const after = {
    vetName: parsed.data.vetName || null,
    vetPhone: parsed.data.vetPhone || null,
    vetPracticeName: parsed.data.vetPracticeName || null,
    vetAddressLine1: parsed.data.vetAddressLine1 || null,
    vetAddressLine2: parsed.data.vetAddressLine2 || null,
    vetCity: parsed.data.vetCity || null,
    vetPostcode: parsed.data.vetPostcode || null,
    vetEmail: parsed.data.vetEmail || null,
  }

  await prisma.user.update({ where: { id: session.user.id }, data: after })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_VET_PRACTICE",
    entity: "User",
    entityId: session.user.id,
    context: `customer ${before.name} <${before.email}> (self-service)`,
    before,
    after,
    labels: {
      vetName: "Consultant's name",
      vetPhone: "Phone",
      vetPracticeName: "Practice name",
      vetAddressLine1: "Vet address line 1",
      vetAddressLine2: "Vet address line 2",
      vetCity: "Vet town/city",
      vetPostcode: "Vet postcode",
      vetEmail: "Practice email",
    },
  })

  revalidatePath("/portal/account")
  return { status: "success", message: "Vet practice updated." }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  })

export async function changePassword(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.passwordHash) {
    return { status: "error", message: "This account has no password set." }
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) {
    return { status: "error", message: "Current password is incorrect." }
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })

  return { status: "success", message: "Password updated." }
}

const notificationPreferenceSchema = z.object({
  channel: z.enum(["EMAIL", "SMS", "BOTH", "NONE"]),
})

export async function updateNotificationPreference(
  _prevState: NotificationActionState,
  formData: FormData
): Promise<NotificationActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = notificationPreferenceSchema.safeParse({ channel: formData.get("channel") })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  if (parsed.data.channel === "SMS" || parsed.data.channel === "BOTH") {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user?.phone) {
      return { status: "error", message: "Add a phone number above before enabling SMS." }
    }
  }

  await prisma.notificationPreference.upsert({
    where: { customerId: session.user.id },
    update: { channel: parsed.data.channel },
    create: { customerId: session.user.id, channel: parsed.data.channel },
  })

  revalidatePath("/portal/account")
  return { status: "success", message: "Notification preference saved.", channel: parsed.data.channel }
}

export async function setAbandonedBookingOptOut(optedOut: boolean): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  await setOptOut(session.user.id, "ABANDONED_BOOKING_REMINDER", optedOut)
  revalidatePath("/portal/account")
  return { status: "success", message: optedOut ? "You won't receive these reminders." : "Reminders re-enabled." }
}

export async function openBillingPortal(): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  if (!stripe) {
    return { status: "error", message: "Online payment isn't enabled yet." }
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user?.stripeCustomerId) {
    return {
      status: "error",
      message: "You don't have any saved payment methods yet — this becomes available after your first payment.",
    }
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getSiteUrl()}/portal/account`,
  })

  redirect(portalSession.url)
}

export async function deleteAccount() {
  const session = await auth()
  if (!session?.user) return

  try {
    await prisma.user.delete({ where: { id: session.user.id } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name: "Deleted user",
          email: `deleted-${randomUUID()}@bedlaygardens.invalid`,
          passwordHash: null,
          phone: null,
          workPhone: null,
          addressLine1: null,
          addressLine2: null,
          addressCity: null,
          addressPostcode: null,
          vetName: null,
          vetPhone: null,
          vetPracticeName: null,
          vetAddressLine1: null,
          vetAddressLine2: null,
          vetCity: null,
          vetPostcode: null,
          vetEmail: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          emergencyContactAddressLine1: null,
          emergencyContactAddressLine2: null,
          emergencyContactCity: null,
          emergencyContactPostcode: null,
          active: false,
        },
      })
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      // Already deleted (e.g. a stale session retrying after a prior successful
      // delete) — nothing left to do but sign out below.
    } else {
      throw error
    }
  }

  await signOut({ redirectTo: "/" })
}
