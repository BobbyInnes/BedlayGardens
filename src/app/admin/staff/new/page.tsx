import type { Metadata } from "next"
import { auth } from "@/auth"
import { canManageAdmins, superAdminSlotAvailable } from "@/lib/admin-permissions"
import { StaffForm } from "@/components/admin/staff-form"
import { createStaff } from "@/app/admin/staff/actions"

export const metadata: Metadata = {
  title: "Add Staff | Admin",
}

export default async function NewStaffPage() {
  const session = await auth()
  const viewerCanManageAdmins = session ? await canManageAdmins(session) : false
  const slotAvailable = await superAdminSlotAvailable()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add staff member</h1>
      <StaffForm
        action={createStaff}
        submitLabel="Create account"
        showPassword
        viewerIsSuperAdmin={viewerCanManageAdmins}
        superAdminSlotAvailable={slotAvailable}
      />
    </div>
  )
}
