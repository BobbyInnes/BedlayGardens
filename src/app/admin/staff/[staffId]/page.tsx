import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageAdmins, superAdminSlotAvailable } from "@/lib/admin-permissions"
import { StaffForm } from "@/components/admin/staff-form"
import { ResetPasswordForm } from "@/components/admin/reset-password-form"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { updateStaff, deleteStaff } from "@/app/admin/staff/actions"

export const metadata: Metadata = {
  title: "Edit Staff | Admin",
}

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ staffId: string }>
}) {
  const { staffId } = await params
  const [session, staff] = await Promise.all([
    auth(),
    prisma.user.findUnique({ where: { id: staffId } }),
  ])
  if (!staff || (staff.role !== "STAFF" && staff.role !== "ADMIN")) notFound()

  const viewerIsSuperAdmin = session ? await canManageAdmins(session) : false
  const isSelf = session?.user.id === staffId

  if (staff.role === "ADMIN" && !viewerIsSuperAdmin && !isSelf) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Edit {staff.name}</h1>
        <p className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Only a super admin can view or edit an admin account.
        </p>
      </div>
    )
  }

  const slotAvailable = await superAdminSlotAvailable(staffId)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {staff.name}</h1>
      </div>

      <StaffForm
        staff={staff}
        action={updateStaff.bind(null, staffId)}
        submitLabel="Save changes"
        viewerIsSuperAdmin={viewerIsSuperAdmin}
        superAdminSlotAvailable={slotAvailable}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reset password</h2>
        <ResetPasswordForm staffId={staff.id} />
      </section>

      {session?.user.isSuperAdmin && session.user.id !== staff.id && (
        <section className="space-y-3 rounded-lg border border-destructive/50 p-4">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="text-sm text-muted-foreground">
            Permanently deletes this account, their audit log entries, and any incident reports
            they filed. This cannot be undone.
          </p>
          <ConfirmDeleteButton
            label="Delete staff account"
            title={`Delete ${staff.name}?`}
            description={`This will permanently delete ${staff.name}'s account, their audit log entries, and any incident reports they filed. This cannot be undone.`}
            onConfirm={deleteStaff.bind(null, staff.id)}
          />
        </section>
      )}
    </div>
  )
}
