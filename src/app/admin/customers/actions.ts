"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit, logEntityChange } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { getSettings } from "@/lib/settings"
import { formatPence, fullName } from "@/lib/format"
import { canManageAdmins } from "@/lib/admin-permissions"
import { deleteCustomerAndAllData } from "@/lib/delete-customer"
import { saveUpload } from "@/lib/storage"
import { checkWaitlistAfterVaccination } from "@/lib/waitlist"
import { checkPendingVaccinationBookings } from "@/lib/booking-vaccination-risk"
import type { DogFlagType } from "@/generated/prisma/client"

export type AdminActionState = { status: "idle" | "error"; message?: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export async function updateCustomerNotes(
  customerId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const notes = ((formData.get("adminNotes") as string | null) ?? "").trim()

  const before = await prisma.user.findUniqueOrThrow({ where: { id: customerId } })
  const after = { adminNotes: notes || null }

  await prisma.user.update({ where: { id: customerId }, data: after })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_CUSTOMER_NOTES",
    entity: "User",
    entityId: customerId,
    context: `customer ${fullName(before)} <${before.email}>`,
    before,
    after,
    labels: { adminNotes: "Admin notes" },
  })

  revalidatePath(`/admin/customers/${customerId}`)
  return { status: "idle", message: "Notes saved." }
}

export async function updateCustomerContactDetails(
  customerId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const forename = ((formData.get("forename") as string | null) ?? "").trim()
  const surname = ((formData.get("surname") as string | null) ?? "").trim()
  if (!forename || !surname) {
    return { status: "error", message: "Forename and surname are required." }
  }

  const before = await prisma.user.findUniqueOrThrow({ where: { id: customerId } })
  const after = {
    forename,
    surname,
    phone: ((formData.get("phone") as string | null) ?? "").trim() || null,
    workPhone: ((formData.get("workPhone") as string | null) ?? "").trim() || null,
    addressLine1: ((formData.get("addressLine1") as string | null) ?? "").trim() || null,
    addressLine2: ((formData.get("addressLine2") as string | null) ?? "").trim() || null,
    addressCity: ((formData.get("addressCity") as string | null) ?? "").trim() || null,
    addressPostcode: ((formData.get("addressPostcode") as string | null) ?? "").trim() || null,
  }

  await prisma.user.update({ where: { id: customerId }, data: after })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_CUSTOMER_DETAILS",
    entity: "User",
    entityId: customerId,
    context: `customer ${fullName(before)} <${before.email}>`,
    before,
    after,
    labels: {
      forename: "Forename",
      surname: "Surname",
      phone: "Phone",
      workPhone: "Work phone",
      addressLine1: "Address line 1",
      addressLine2: "Address line 2",
      addressCity: "City",
      addressPostcode: "Postcode",
    },
  })

  revalidatePath(`/admin/customers/${customerId}`)
  return { status: "idle", message: "Details saved." }
}

export async function toggleCustomerActive(customerId: string, active: boolean) {
  const session = await requireAdmin()

  const before = await prisma.user.findUniqueOrThrow({ where: { id: customerId } })
  await prisma.user.update({ where: { id: customerId }, data: { active } })

  await logEntityChange({
    actorId: session.user.id,
    action: "TOGGLE_CUSTOMER_ACTIVE",
    entity: "User",
    entityId: customerId,
    context: `customer ${fullName(before)} <${before.email}>`,
    before,
    after: { active },
    labels: { active: "Active" },
  })

  revalidatePath("/admin/customers")
  revalidatePath(`/admin/customers/${customerId}`)
}

/**
 * Converts an existing customer account into a Staff/Admin account, rather
 * than requiring a brand new user (email must be unique across every role,
 * so someone who's already booked as a customer can't otherwise be added as
 * staff under the same address). Keeps their existing password — an admin
 * can reset it afterwards from the staff edit page if needed.
 */
export async function promoteCustomerToStaff(customerId: string, role: "STAFF" | "ADMIN") {
  const session = await requireAdmin()
  const customer = await prisma.user.findFirst({ where: { id: customerId, role: "CUSTOMER" } })
  if (!customer) {
    throw new Error("Customer not found.")
  }
  if (role === "ADMIN" && !(await canManageAdmins(session))) {
    throw new Error("Only a super admin can promote someone to admin.")
  }

  await prisma.user.update({ where: { id: customerId }, data: { role } })
  await logAudit({
    actorId: session.user.id,
    action: "PROMOTE_CUSTOMER_TO_STAFF",
    entity: "User",
    entityId: customerId,
    meta: role,
  })

  revalidatePath("/admin/customers")
  revalidatePath("/staff/team")
  redirect(`/staff/team/${customerId}`)
}

export async function addDogFlag(
  customerId: string,
  dogId: string,
  type: DogFlagType,
  notes: string
) {
  const session = await requireAdmin()
  await prisma.dogFlag.create({ data: { dogId, type, notes: notes.trim() || null } })
  await logAudit({
    actorId: session.user.id,
    action: "ADD_DOG_FLAG",
    entity: "Dog",
    entityId: dogId,
    meta: type,
  })
  revalidatePath(`/admin/customers/${customerId}`)
}

// Records staff manually seeing/confirming a certificate themselves (phone
// customer reads it out, or a physical copy brought in) — status goes
// straight to VERIFIED with this admin as the verifier, unlike a customer's
// own upload which lands UNVERIFIED and waits in the review queue.
export async function addVaccinationRecordManually(
  customerId: string,
  dogId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()

  const type = ((formData.get("type") as string | null) ?? "").trim()
  const dateGivenRaw = formData.get("dateGiven") as string | null
  const expiryDateRaw = formData.get("expiryDate") as string | null
  if (!type || !dateGivenRaw || !expiryDateRaw) {
    return { status: "error", message: "Vaccine type, date given, and expiry date are required." }
  }

  const dog = await prisma.dog.findFirst({
    where: { id: dogId, ownerId: customerId },
    include: { owner: true },
  })
  if (!dog) {
    return { status: "error", message: "Dog not found." }
  }

  let documentUrl: string | null = null
  const certificate = formData.get("certificate")
  if (certificate instanceof File && certificate.size > 0) {
    const buffer = Buffer.from(await certificate.arrayBuffer())
    documentUrl = await saveUpload(`vaccinations/${dogId}`, certificate.name, buffer)
  }

  const record = await prisma.vaccinationRecord.create({
    data: {
      dogId,
      type,
      dateGiven: new Date(dateGivenRaw),
      expiryDate: new Date(expiryDateRaw),
      documentUrl,
      status: "VERIFIED",
      verifiedById: session.user.id,
      verifiedAt: new Date(),
    },
  })

  await logAudit({
    actorId: session.user.id,
    action: "ADD_VACCINATION_RECORD_MANUALLY",
    entity: "VaccinationRecord",
    entityId: record.id,
    meta: `${type} for ${dog.name}, owner ${fullName(dog.owner)} <${dog.owner.email}> — ${record.dateGiven.toLocaleDateString("en-GB")} to ${record.expiryDate.toLocaleDateString("en-GB")} — added manually by ${fullName(session.user)}`,
  })

  await checkWaitlistAfterVaccination(dogId)
  await checkPendingVaccinationBookings(dogId)

  revalidatePath(`/admin/customers/${customerId}`)
  return { status: "idle", message: "Vaccination record added." }
}

// Run type, temperament, and group-play approval are a kennel assessment,
// not something the customer enters or sees — only admins set these, from
// what staff observe of the dog on site.
export async function updateDogCareProfile(
  customerId: string,
  dogId: string,
  fields: { runType: string; temperament: string; groupPlayApproved: boolean }
) {
  const session = await requireAdmin()
  const dog = await prisma.dog.findFirst({ where: { id: dogId, ownerId: customerId } })
  if (!dog) throw new Error("Dog not found.")

  const after = {
    runType: fields.runType.trim() || null,
    temperament: fields.temperament.trim() || null,
    groupPlayApproved: fields.groupPlayApproved,
  }
  await prisma.dog.update({ where: { id: dogId }, data: after })

  await logEntityChange({
    actorId: session.user.id,
    action: "UPDATE_DOG_CARE_PROFILE",
    entity: "Dog",
    entityId: dogId,
    context: `dog ${dog.name}`,
    before: dog,
    after,
    labels: {
      runType: "Run type",
      temperament: "Temperament",
      groupPlayApproved: "Group play approved",
    },
  })

  revalidatePath(`/admin/customers/${customerId}`)
}

export async function removeDogFlag(customerId: string, flagId: string) {
  const session = await requireAdmin()
  const flag = await prisma.dogFlag.findUnique({ where: { id: flagId } })
  if (!flag) return
  await prisma.dogFlag.delete({ where: { id: flagId } })
  await logAudit({
    actorId: session.user.id,
    action: "REMOVE_DOG_FLAG",
    entity: "Dog",
    entityId: flag.dogId,
    meta: flag.type,
  })
  revalidatePath(`/admin/customers/${customerId}`)
}

// Irreversible — deletes the customer, their dogs, and every booking, not
// just the account itself. Restricted to super admins (not just any admin),
// since regular staff shouldn't be able to erase booking/financial history.
export async function deleteCustomer(customerId: string) {
  const session = await requireAdmin()
  if (!session.user.isSuperAdmin) {
    throw new Error("Only a super admin can delete a customer.")
  }

  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    include: { _count: { select: { dogs: true, bookings: true } } },
  })
  if (!customer) {
    throw new Error("Customer not found.")
  }

  await prisma.$transaction((tx) => deleteCustomerAndAllData(tx, customerId))
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_CUSTOMER",
    entity: "User",
    entityId: customerId,
    meta: `${fullName(customer)} <${customer.email}> — ${customer._count.dogs} dog(s), ${customer._count.bookings} booking(s) deleted`,
  })

  revalidatePath("/admin/customers")
  redirect("/admin/customers")
}

export async function issueGoodwillCredit(
  customerId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const amountPence = Math.round(Number(formData.get("amountPounds")) * 100)
  const reason = ((formData.get("reason") as string | null) ?? "").trim()

  if (!amountPence || amountPence <= 0) {
    return { status: "error", message: "Enter a positive amount." }
  }

  const customer = await prisma.user.findUnique({ where: { id: customerId } })

  await prisma.creditLedger.create({
    data: { customerId, amountPence, reason: reason || "Goodwill credit" },
  })
  await logAudit({
    actorId: session.user.id,
    action: "ISSUE_GOODWILL_CREDIT",
    entity: "User",
    entityId: customerId,
    meta: `Customer: ${customer ? fullName(customer) : "Unknown"} (ID: ${customerId}) — ${formatPence(amountPence)} — ${reason}`,
  })

  if (customer) {
    const settings = await getSettings()
    await sendEmail({
      to: customer.email,
      subject: "Account credit added",
      html: `<p>We've added ${formatPence(amountPence)} of account credit to your ${settings.business_name ?? "Bedlay Gardens LTD"} account${reason ? `: ${reason}` : "."}</p>`,
    })
  }

  revalidatePath(`/admin/customers/${customerId}`)
  return { status: "idle", message: "Credit issued." }
}
