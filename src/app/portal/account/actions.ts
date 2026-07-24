"use server"

import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { Prisma } from "@/generated/prisma/client"
import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import { stripe, getSiteUrl } from "@/lib/stripe"
import { setOptOut } from "@/lib/notification-preferences"

export type ActionState = { status: "idle" | "success" | "error"; message?: string }

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

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      workPhone: parsed.data.workPhone || null,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 || null,
      addressCity: parsed.data.addressCity || null,
      addressPostcode: parsed.data.addressPostcode || null,
    },
  })

  return { status: "success", message: "Details updated." }
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
  channel: z.enum(["EMAIL", "SMS", "BOTH"]),
})

export async function updateNotificationPreference(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  const parsed = notificationPreferenceSchema.safeParse({ channel: formData.get("channel") })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  if (parsed.data.channel !== "EMAIL") {
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

  return { status: "success", message: "Notification preference saved." }
}

export async function setAbandonedBookingOptOut(optedOut: boolean): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Unauthorized" }

  await setOptOut(session.user.id, "ABANDONED_BOOKING_REMINDER", optedOut)
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
          active: false,
        },
      })
    } else {
      throw error
    }
  }

  await signOut({ redirectTo: "/" })
}
