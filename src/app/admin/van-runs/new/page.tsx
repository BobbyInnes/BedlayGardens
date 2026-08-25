import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { VanRunForm } from "@/components/admin/van-run-form"
import { createVanRun } from "@/app/admin/van-runs/actions"
import { fullName } from "@/lib/format"

export const metadata: Metadata = {
  title: "New Van Run | Admin",
}

export default async function NewVanRunPage() {
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "ADMIN"] }, active: true },
    orderBy: [{ surname: "asc" }, { forename: "asc" }],
    select: { id: true, forename: true, surname: true },
  })
  const staffOptions = staffUsers.map((u) => ({ id: u.id, name: fullName(u) }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create van run</h1>
      <VanRunForm staffOptions={staffOptions} action={createVanRun} submitLabel="Create run" />
    </div>
  )
}
