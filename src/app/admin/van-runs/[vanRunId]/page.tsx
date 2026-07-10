import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { VanRunForm } from "@/components/admin/van-run-form"
import { VanRunStopsList } from "@/components/admin/van-run-stops-list"
import { updateVanRun } from "@/app/admin/van-runs/actions"

export const metadata: Metadata = {
  title: "Edit Van Run | Admin",
}

export default async function EditVanRunPage({
  params,
}: {
  params: Promise<{ vanRunId: string }>
}) {
  const { vanRunId } = await params
  const [vanRun, staffOptions] = await Promise.all([
    prisma.vanRun.findUnique({
      where: { id: vanRunId },
      include: { stops: { include: { dog: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  if (!vanRun) notFound()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit van run</h1>
      <VanRunForm
        vanRun={vanRun}
        staffOptions={staffOptions}
        action={updateVanRun.bind(null, vanRun.id)}
        submitLabel="Save changes"
      />

      <section className="max-w-md space-y-3">
        <h2 className="text-sm font-semibold">Stops (pickup order)</h2>
        <VanRunStopsList
          vanRunId={vanRun.id}
          stops={vanRun.stops.map((stop) => ({
            id: stop.id,
            dogName: stop.dog.name,
            pickupAddress: stop.pickupAddress,
            status: stop.status,
          }))}
        />
      </section>
    </div>
  )
}
