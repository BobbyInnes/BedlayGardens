import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { BookingFilters } from "@/components/portal/booking-filters"
import { BookServiceCta } from "@/components/portal/book-service-cta"
import { BookingCard } from "@/components/portal/booking-card"

export const metadata: Metadata = {
  title: "My Bookings",
}

export default async function PortalBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string; serviceId?: string }>
}) {
  const { dogId, serviceId } = await searchParams
  const session = await auth()

  const [freeDays, noRefundHours] = await Promise.all([
    getSetting("cancellation_free_days", "14"),
    getSetting("cancellation_no_refund_hours", "48"),
  ])

  const [dogs, services] = await Promise.all([
    prisma.dog.findMany({
      where: { ownerId: session!.user.id },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { bookings: { some: { customerId: session!.user.id } } },
      orderBy: { name: "asc" },
    }),
  ])
  const selectedDog = dogId ? dogs.find((dog) => dog.id === dogId) : undefined
  const selectedService = serviceId ? services.find((service) => service.id === serviceId) : undefined

  const bookings = await prisma.booking.findMany({
    where: {
      customerId: session!.user.id,
      // Bookings needing action (e.g. a missing vaccine certificate) live on
      // the Waitlist page instead, not here — see /portal/waitlist.
      status: { not: "PENDING_VACCINATION" },
      ...(selectedDog ? { bookingDogs: { some: { dogId: selectedDog.id } } } : {}),
      ...(selectedService ? { serviceId: selectedService.id } : {}),
    },
    orderBy: { startDate: selectedDog || selectedService ? "asc" : "desc" },
    include: {
      service: true,
      payments: true,
      trialVisits: { include: { dog: true } },
      bookingDogs: { include: { dog: true } },
    },
  })

  return (
    <div className="max-w-2xl space-y-6">
      <BookServiceCta
        hasDogs={dogs.length > 0}
        filters={
          <BookingFilters
            dogs={dogs}
            services={services}
            selectedDogId={selectedDog?.id}
            selectedServiceId={selectedService?.id}
          />
        }
      />

      {bookings.length > 0 ? (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              freeDays={Number(freeDays)}
              noRefundHours={Number(noRefundHours)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">You don&rsquo;t have any bookings yet.</p>
      )}
    </div>
  )
}
