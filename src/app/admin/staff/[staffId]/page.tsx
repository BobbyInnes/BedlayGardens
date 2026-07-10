import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { StaffForm } from "@/components/admin/staff-form"
import { ResetPasswordForm } from "@/components/admin/reset-password-form"
import { updateStaff } from "@/app/admin/staff/actions"

export const metadata: Metadata = {
  title: "Edit Staff | Admin",
}

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ staffId: string }>
}) {
  const { staffId } = await params
  const staff = await prisma.user.findUnique({ where: { id: staffId } })
  if (!staff || (staff.role !== "STAFF" && staff.role !== "ADMIN")) notFound()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {staff.name}</h1>
      </div>

      <StaffForm staff={staff} action={updateStaff.bind(null, staffId)} submitLabel="Save changes" />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reset password</h2>
        <ResetPasswordForm staffId={staff.id} />
      </section>
    </div>
  )
}
