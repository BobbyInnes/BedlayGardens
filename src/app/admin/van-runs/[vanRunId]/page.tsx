import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { VanRunForm } from "@/components/admin/van-run-form"
import { VanRunStopsList } from "@/components/admin/van-run-stops-list"
import { VanRunAddStopForm } from "@/components/admin/van-run-add-stop-form"
import { updateVanRun } from "@/app/admin/van-runs/actions"
import { fullName } from "@/lib/format"
import { WALK_TYPE_LABELS } from "@/lib/walk-types"

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
    prisma.user
      .findMany({
        where: { role: { in: ["STAFF", "ADMIN"] }, active: true },
        orderBy: [{ surname: "asc" }, { forename: "asc" }],
        select: { id: true, forename: true, surname: true },
      })
      .then((users) => users.map((u) => ({ id: u.id, name: fullName(u) }))),
  ])
  if (!vanRun) notFound()

  // Dog Walking bookings no longer pick a run at booking time (see
  // WalkType) — these are that date's bookings still waiting to be assigned
  // to an actual run, offered here via VanRunAddStopForm.
  const unassignedBookings = await prisma.booking.findMany({
    where: {
      service: { slug: "dog-walking" },
      startDate: vanRun.date,
      status: { notIn: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] },
      vanRunStops: { none: {} },
    },
    include: { customer: true, bookingDogs: { include: { dog: true } } },
    orderBy: { createdAt: "asc" },
  })

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
        <VanRunAddStopForm
          vanRunId={vanRun.id}
          options={unassignedBookings.map((booking) => ({
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            customerName: fullName(booking.customer),
            dogNames: booking.bookingDogs.map((bd) => bd.dog.name).join(", "),
            walkTypeLabel: booking.walkType ? WALK_TYPE_LABELS[booking.walkType] : "—",
          }))}
        />
      </section>
    </div>
  )
}
