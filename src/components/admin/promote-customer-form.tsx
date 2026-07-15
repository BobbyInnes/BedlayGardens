"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { promoteCustomerToStaff } from "@/app/admin/customers/actions"

export function PromoteCustomerForm({
  customerId,
  viewerCanManageAdmins = false,
}: {
  customerId: string
  /** Whether the logged-in admin is a super admin (or bootstrapping the first one) — only they can promote to Admin. */
  viewerCanManageAdmins?: boolean
}) {
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF")
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select value={role} onValueChange={(value) => setRole(value as "STAFF" | "ADMIN")}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="STAFF">Staff</SelectItem>
          {viewerCanManageAdmins && <SelectItem value="ADMIN">Admin</SelectItem>}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => promoteCustomerToStaff(customerId, role))}
      >
        {pending ? "Promoting…" : "Promote to staff"}
      </Button>
    </div>
  )
}
