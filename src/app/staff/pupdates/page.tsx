import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { PupdateForm } from "@/components/staff/pupdate-form"

export const metadata: Metadata = {
  title: "Pupdates | Staff",
}

const ON_SITE_SERVICE_SLUGS = ["overnight-boarding", "daycare"]

export default async function StaffPupdatesPage() {
  const [inHouseBookings, recentPupdates] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "CHECKED_IN", service: { slug: { in: ON_SITE_SERVICE_SLUGS } } },
      include: { customer: true, bookingDogs: { include: { dog: true } } },
    }),
    prisma.pupdate.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { dog: true, mediaItem: true },
    }),
  ])

  const dogs = inHouseBookings.flatMap((booking) =>
    booking.bookingDogs.map((bd) => ({
      bookingId: booking.id,
      dogId: bd.dogId,
      dogName: bd.dog.name,
      customerName: booking.customer.name,
    }))
  )

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pupdates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a photo or video from a dog&rsquo;s stay — the owner is emailed immediately.
        </p>
      </div>

      {dogs.length > 0 ? (
        <PupdateForm dogs={dogs} />
      ) : (
        <p className="text-sm text-muted-foreground">No dogs are currently checked in.</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent pupdates</h2>
        {recentPupdates.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentPupdates.map((pupdate) => (
              <li key={pupdate.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
                {pupdate.mediaItem && (
                  <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {pupdate.mediaItem.type === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${pupdate.mediaItem.url}`}
                        alt={pupdate.dog.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <video src={`/api/files/${pupdate.mediaItem.url}`} className="size-full object-cover" muted />
                    )}
                  </div>
                )}
                <p className="font-medium">{pupdate.dog.name}</p>
                {pupdate.note && <p className="text-muted-foreground">{pupdate.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {pupdate.createdAt.toLocaleDateString("en-GB")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No pupdates posted yet.</p>
        )}
      </section>
    </div>
  )
}
