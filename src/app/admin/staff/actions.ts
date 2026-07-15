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

export type AdminActionState = { status: "idle" | "error"; message?: string }

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
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email address").max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional().or(z.literal("")),
  bio: z.string().trim().max(4000).optional().or(z.literal("")),
  role: z.enum(["STAFF", "ADMIN"]),
})

function revalidateStaffPaths() {
  revalidatePath("/admin/staff")
  revalidatePath("/about")
}

export async function createStaff(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAdmin()

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    jobTitle: formData.get("jobTitle"),
    bio: formData.get("bio"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const canManage = await canManageAdmins(session)
  if (parsed.data.role === "ADMIN" && !canManage) {
    return { status: "error", message: "Only a super admin can create an admin account." }
  }

  const password = (formData.get("password") as string | null)?.trim()
  if (!password || password.length < 8) {
    return { status: "error", message: "Set a temporary password of at least 8 characters." }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return { status: "error", message: "A user with that email already exists." }
  }

  const wantsSuperAdmin =
    parsed.data.role === "ADMIN" && canManage && formData.get("isSuperAdmin") === "on"
  if (wantsSuperAdmin && !(await superAdminSlotAvailable())) {
    return {
      status: "error",
      message: `There can only be ${MAX_SUPER_ADMINS} super admins at a time. Remove super admin status from another account first.`,
    }
  }

  let photoUrl: string | null = null
  const photo = formData.get("photo")
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer())
    photoUrl = await savePublicUpload("staff", photo.name, buffer)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      name: parsed.data.name,
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

  revalidateStaffPaths()
  redirect("/admin/staff")
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
  if (staff.role === "ADMIN" && !viewerCanManage) {
    return { status: "error", message: "Only a super admin can edit an admin account." }
  }

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    jobTitle: formData.get("jobTitle"),
    bio: formData.get("bio"),
    role: formData.get("role"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  if (parsed.data.role === "ADMIN" && staff.role !== "ADMIN" && !viewerCanManage) {
    return { status: "error", message: "Only a super admin can promote someone to admin." }
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
    }
  }

  if (await wouldRemoveLastSuperAdmin(staffId, wantsSuperAdmin)) {
    return {
      status: "error",
      message: "You can't remove super admin status from the only remaining super admin.",
    }
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: staffId } },
  })
  if (existing) {
    return { status: "error", message: "A user with that email already exists." }
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
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      jobTitle: parsed.data.jobTitle || null,
      bio: parsed.data.bio ? sanitizeRichText(parsed.data.bio) : null,
      photoUrl,
      role: parsed.data.role,
      isSuperAdmin: wantsSuperAdmin,
    },
  })

  revalidateStaffPaths()
  redirect("/admin/staff")
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
  if (staff.role === "ADMIN" && !(await canManageAdmins(session))) {
    return { status: "error", message: "Only a super admin can reset an admin's password." }
  }

  const newPassword = (formData.get("newPassword") as string | null)?.trim()
  if (!newPassword || newPassword.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: staffId }, data: { passwordHash } })

  return { status: "idle", message: "Password reset." }
}
