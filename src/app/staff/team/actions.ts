"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { savePublicUpload, deletePublicUpload } from "@/lib/storage"
import { sanitizeRichText } from "@/lib/sanitize-html"
import { canManageAdmins, superAdminSlotAvailable, MAX_SUPER_ADMINS } from "@/lib/admin-permissions"
import { logAudit } from "@/lib/audit"
import { deleteStaffAndAllData } from "@/lib/delete-staff"
import { fullName } from "@/lib/format"

export type AdminActionState = {
  status: "idle" | "error"
  message?: string
  values?: {
    forename: string
    surname: string
    email: string
    phone: string
    jobTitle: string
    bio: string
    role: "STAFF" | "ADMIN"
    isSuperAdmin: boolean
  }
}

/** Re-reads whatever the user submitted so a failed save can refill the form instead of blanking it. */
function formValues(formData: FormData): NonNullable<AdminActionState["values"]> {
  return {
    forename: (formData.get("forename") as string | null) ?? "",
    surname: (formData.get("surname") as string | null) ?? "",
    email: (formData.get("email") as string | null) ?? "",
    phone: (formData.get("phone") as string | null) ?? "",
    jobTitle: (formData.get("jobTitle") as string | null) ?? "",
    bio: (formData.get("bio") as string | null) ?? "",
    role: formData.get("role") === "ADMIN" ? "ADMIN" : "STAFF",
    isSuperAdmin: formData.get("isSuperAdmin") === "on",
  }
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

/** Blocks removing super admin status if it would leave the business with none. */
async function wouldRemoveLastSuperAdmin(userId: string, nextIsSuperAdmin: boolean) {
  if (nextIsSuperAdmin) return false
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target?.isSuperAdmin) return false
  const remaining = await prisma.user.count({ where: { isSuperAdmin: true, active: true } })
  return remaining <= 1
}

const staffSchema = z.object({
  forename: z.string().trim().min(1, "Forename is required").max(100),
  surname: z.string().trim().min(1, "Surname is required").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional().or(z.literal("")),
  bio: z.string().trim().max(4000).optional().or(z.literal("")),
  role: z.enum(["STAFF", "ADMIN"]),
})

function revalidateStaffPaths() {
  revalidatePath("/staff/team")
  revalidatePath("/about")
}

export async function createStaff(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()

  const parsed = staffSchema.safeParse({
    forename: formData.get("forename"),
    surname: formData.get("surname"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    jobTitle: formData.get("jobTitle"),
    bio: formData.get("bio"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      values: formValues(formData),
    }
  }

  const canManage = await canManageAdmins(session)
  if (parsed.data.role === "ADMIN" && !canManage) {
    return {
      status: "error",
      message: "Only a super admin can create an admin account.",
      values: formValues(formData),
    }
  }

  const password = (formData.get("password") as string | null)?.trim()
  if (!password || password.length < 8) {
    return {
      status: "error",
      message: "Set a temporary password of at least 8 characters.",
      values: formValues(formData),
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return {
      status: "error",
      message: "A user with that email already exists.",
      values: formValues(formData),
    }
  }

  const wantsSuperAdmin =
    parsed.data.role === "ADMIN" && canManage && formData.get("isSuperAdmin") === "on"
  if (wantsSuperAdmin && !(await superAdminSlotAvailable())) {
    return {
      status: "error",
      message: `There can only be ${MAX_SUPER_ADMINS} super admins at a time. Remove super admin status from another account first.`,
      values: formValues(formData),
    }
  }

  let photoUrl: string | null = null
  const photo = formData.get("photo")
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer())
    photoUrl = await savePublicUpload("staff", photo.name, buffer)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const newStaff = await prisma.user.create({
    data: {
      forename: parsed.data.forename,
      surname: parsed.data.surname,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      jobTitle: parsed.data.jobTitle || null,
      bio: parsed.data.bio ? sanitizeRichText(parsed.data.bio) : null,
      photoUrl,
      role: parsed.data.role,
      isSuperAdmin: wantsSuperAdmin,
      passwordHash,
      emailVerified: new Date(),
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "CREATE_STAFF",
    entity: "User",
    entityId: newStaff.id,
    meta: `${fullName(parsed.data)} <${parsed.data.email}> — ${parsed.data.role}${wantsSuperAdmin ? " (super admin)" : ""}`,
  })

  revalidateStaffPaths()
  redirect("/staff/team")
}

export async function updateStaff(
  staffId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const staff = await prisma.user.findUnique({ where: { id: staffId } })
  if (!staff) {
    return { status: "error", message: "Staff member not found." }
  }

  const viewerCanManage = await canManageAdmins(session)
  const isSelf = session.user.id === staffId
  if (staff.role === "ADMIN" && !viewerCanManage && !isSelf) {
    return {
      status: "error",
      message: "Only a super admin can edit an admin account.",
      values: formValues(formData),
    }
  }

  const parsed = staffSchema.safeParse({
    forename: formData.get("forename"),
    surname: formData.get("surname"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    jobTitle: formData.get("jobTitle"),
    bio: formData.get("bio"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      values: formValues(formData),
    }
  }

  if (parsed.data.role === "ADMIN" && staff.role !== "ADMIN" && !viewerCanManage) {
    return {
      status: "error",
      message: "Only a super admin can promote someone to admin.",
      values: formValues(formData),
    }
  }

  const wantsSuperAdmin =
    parsed.data.role === "ADMIN" && viewerCanManage
      ? formData.get("isSuperAdmin") === "on"
      : false

  if (
    wantsSuperAdmin &&
    !staff.isSuperAdmin &&
    !(await superAdminSlotAvailable(staffId))
  ) {
    return {
      status: "error",
      message: `There can only be ${MAX_SUPER_ADMINS} super admins at a time. Remove super admin status from another account first.`,
      values: formValues(formData),
    }
  }

  if (await wouldRemoveLastSuperAdmin(staffId, wantsSuperAdmin)) {
    return {
      status: "error",
      message: "You can't remove super admin status from the only remaining super admin.",
      values: formValues(formData),
    }
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: staffId } },
  })
  if (existing) {
    return {
      status: "error",
      message: "A user with that email already exists.",
      values: formValues(formData),
    }
  }

  let photoUrl = staff.photoUrl
  const photo = formData.get("photo")
  if (photo instanceof File && photo.size > 0) {
    if (photoUrl) {
      await deletePublicUpload(photoUrl).catch(() => {})
    }
    const buffer = Buffer.from(await photo.arrayBuffer())
    photoUrl = await savePublicUpload("staff", photo.name, buffer)
  }

  await prisma.user.update({
    where: { id: staffId },
    data: {
      forename: parsed.data.forename,
      surname: parsed.data.surname,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      jobTitle: parsed.data.jobTitle || null,
      bio: parsed.data.bio ? sanitizeRichText(parsed.data.bio) : null,
      photoUrl,
      role: parsed.data.role,
      isSuperAdmin: wantsSuperAdmin,
    },
  })
  await logAudit({
    actorId: session.user.id,
    action: "UPDATE_STAFF",
    entity: "User",
    entityId: staffId,
    meta: `${fullName(parsed.data)} <${parsed.data.email}> — ${parsed.data.role}${wantsSuperAdmin ? " (super admin)" : ""}${
      wantsSuperAdmin !== staff.isSuperAdmin ? ` [super admin status ${wantsSuperAdmin ? "granted" : "removed"}]` : ""
    }`,
  })

  revalidateStaffPaths()
  redirect("/staff/team")
}

export async function toggleStaffActive(staffId: string, active: boolean) {
  const session = await requireAdmin()
  const staff = await prisma.user.findUnique({ where: { id: staffId } })
  if (!staff) return
  if (staff.role === "ADMIN" && !(await canManageAdmins(session))) {
    throw new Error("Only a super admin can deactivate an admin account.")
  }
  if (!active && (await wouldRemoveLastSuperAdmin(staffId, false))) {
    throw new Error("You can't deactivate the only remaining super admin.")
  }
  await prisma.user.update({ where: { id: staffId }, data: { active } })
  await logAudit({
    actorId: session.user.id,
    action: "TOGGLE_STAFF_ACTIVE",
    entity: "User",
    entityId: staffId,
    meta: `${fullName(staff)} — ${active ? "activated" : "deactivated"}`,
  })
  revalidateStaffPaths()
}

export async function resetStaffPassword(
  staffId: string,
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()
  const staff = await prisma.user.findUnique({ where: { id: staffId } })
  if (!staff) {
    return { status: "error", message: "Staff member not found." }
  }
  if (staff.role === "ADMIN" && !(await canManageAdmins(session)) && session.user.id !== staffId) {
    return { status: "error", message: "Only a super admin can reset an admin's password." }
  }

  const newPassword = (formData.get("newPassword") as string | null)?.trim()
  if (!newPassword || newPassword.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: staffId }, data: { passwordHash } })
  // Never log the password itself, only that a reset happened.
  await logAudit({
    actorId: session.user.id,
    action: "RESET_STAFF_PASSWORD",
    entity: "User",
    entityId: staffId,
    meta: fullName(staff),
  })

  return { status: "idle", message: "Password reset." }
}

// Irreversible — deletes the staff account and their audit log entries and
// incident reports. Restricted to super admins, same as customer deletion.
export async function deleteStaff(staffId: string) {
  const session = await requireAdmin()
  if (!session.user.isSuperAdmin) {
    throw new Error("Only a super admin can delete a staff account.")
  }
  if (session.user.id === staffId) {
    throw new Error("You can't delete your own account.")
  }

  const staff = await prisma.user.findFirst({
    where: { id: staffId, role: { in: ["STAFF", "ADMIN"] } },
  })
  if (!staff) {
    throw new Error("Staff member not found.")
  }
  if (await wouldRemoveLastSuperAdmin(staffId, false)) {
    throw new Error("You can't delete the only remaining super admin.")
  }

  await prisma.$transaction((tx) => deleteStaffAndAllData(tx, staffId))
  await logAudit({
    actorId: session.user.id,
    action: "DELETE_STAFF",
    entity: "User",
    entityId: staffId,
    meta: `${fullName(staff)} <${staff.email}> — ${staff.role}`,
  })

  revalidateStaffPaths()
  redirect("/staff/team")
}
