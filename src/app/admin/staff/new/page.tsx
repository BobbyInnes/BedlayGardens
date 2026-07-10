import type { Metadata } from "next"
import { StaffForm } from "@/components/admin/staff-form"
import { createStaff } from "@/app/admin/staff/actions"

export const metadata: Metadata = {
  title: "Add Staff | Admin",
}

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add staff member</h1>
      <StaffForm action={createStaff} submitLabel="Create account" showPassword />
    </div>
  )
}
