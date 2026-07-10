import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { toggleStaffActive } from "@/app/admin/staff/actions"

export const metadata: Metadata = {
  title: "Staff | Admin",
}

export default async function AdminStaffPage() {
  const staff = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] } },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <Button size="sm" asChild>
          <Link href="/admin/staff/new">Add staff</Link>
        </Button>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {staff.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{member.name}</span>
                <Badge variant="secondary">{member.role}</Badge>
                <Badge variant={member.active ? "default" : "outline"}>
                  {member.active ? "Active" : "Deactivated"}
                </Badge>
              </div>
              <p className="text-muted-foreground">{member.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/staff/${member.id}`}>Edit</Link>
              </Button>
              <ToggleActiveButton
                active={member.active}
                onToggle={toggleStaffActive.bind(null, member.id)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
