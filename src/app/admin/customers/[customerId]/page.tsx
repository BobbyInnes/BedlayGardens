import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPence } from "@/lib/format"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { CustomerNotesForm } from "@/components/admin/customer-notes-form"
import { CustomerDetailsForm } from "@/components/admin/customer-details-form"
import { DogFlagsManager } from "@/components/admin/dog-flags-manager"
import { GoodwillCreditForm } from "@/components/admin/goodwill-credit-form"
import { PromoteCustomerForm } from "@/components/admin/promote-customer-form"
import { BookingDogTag } from "@/components/ui/booking-dog-tag"
import { toggleCustomerActive, deleteCustomer } from "@/app/admin/customers/actions"
import { getAvailableCreditPence } from "@/lib/vouchers"
import { canManageAdmins } from "@/lib/admin-permissions"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"

const OPEN_BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const
const CANCELLED_STATUSES = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"] as const

const VACCINATION_STATUS_LABELS = {
  UNVERIFIED: "Unverified",
  VERIFIED: "Verified",
  EXPIRED: "Expired",
} as const

export const metadata: Metadata = {
  title: "Customer | Admin",
}

function BookingRow({
  booking,
}: {
  booking: {
    id: string
    startDate: Date
    endDate: Date
    status: string
    totalPence: number
    service: { name: string }
    bookingDogs: { dog: { name: string } }[]
  }
}) {
  return (
    <li className="space-y-1 py-2 text-sm first:pt-0 last:pb-0">
      <Link href={`/admin/bookings/${booking.id}`} className="block hover:underline">
        <p className="whitespace-nowrap font-medium">
          {booking.service.name} <BookingDogTag names={booking.bookingDogs.map((bd) => bd.dog.name)} />
        </p>
      </Link>
      <div className="flex items-center justify-between gap-3">
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          {booking.startDate.toLocaleDateString("en-GB")}
          {booking.endDate.getTime() !== booking.startDate.getTime()
            ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
            : ""}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span>{formatPence(booking.totalPence)}</span>
          <Badge variant="outline">{booking.status.toLowerCase().replace(/_/g, " ")}</Badge>
        </div>
      </div>
    </li>
  )
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const [session, customer] = await Promise.all([
    auth(),
    prisma.user.findFirst({
      where: { id: customerId, role: "CUSTOMER" },
      include: {
        dogs: {
          orderBy: { name: "asc" },
          include: {
            flags: true,
            vaccinationRecords: { orderBy: { expiryDate: "desc" } },
            trialVisits: { orderBy: { completedAt: "desc" }, take: 1, where: { outcome: { not: null } } },
          },
        },
        bookings: {
          orderBy: { startDate: "desc" },
          include: { service: true, payments: true, bookingDogs: { include: { dog: true } } },
          take: 50,
        },
      },
    }),
  ])
  if (!customer) notFound()
  const creditBalancePence = await getAvailableCreditPence(customer.id)
  const viewerCanManageAdmins = session ? await canManageAdmins(session) : false

  const revenuePence = customer.bookings.reduce((sum, booking) => {
    const bookingPayments = booking.payments.reduce((paymentSum, payment) => {
      if (payment.status !== "SUCCEEDED") return paymentSum
      return payment.type === "REFUND" ? paymentSum - payment.amountPence : paymentSum + payment.amountPence
    }, 0)
    return sum + bookingPayments
  }, 0)

  const outstandingPence = customer.bookings.reduce((sum, booking) => {
    if ((CANCELLED_STATUSES as readonly string[]).includes(booking.status) || booking.status === "DRAFT") {
      return sum
    }
    const paidPence = booking.payments
      .filter((p) => p.status === "SUCCEEDED" && p.type !== "REFUND")
      .reduce((s, p) => s + p.amountPence, 0)
    return sum + Math.max(0, booking.totalPence - paidPence)
  }, 0)

  const now = new Date()
  const upcomingBookings = customer.bookings
    .filter((b) => (OPEN_BOOKING_STATUSES as readonly string[]).includes(b.status) && b.endDate >= now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const upcomingIds = new Set(upcomingBookings.map((b) => b.id))
  const pastBookings = customer.bookings.filter((b) => !upcomingIds.has(b.id))

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            Customer since {customer.createdAt.toLocaleDateString("en-GB")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
          <Badge variant={customer.active ? "secondary" : "destructive"}>
            {customer.active ? "Active" : "Banned"}
          </Badge>
          <ToggleActiveButton
            active={customer.active}
            onToggle={toggleCustomerActive.bind(null, customer.id)}
          />
          <Button size="sm" asChild>
            <Link href="/admin/bookings/new">+ Add booking</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-sm font-semibold">Customer details</h2>
            <CustomerDetailsForm
              customerId={customer.id}
              name={customer.name}
              email={customer.email}
              phone={customer.phone ?? ""}
              workPhone={customer.workPhone ?? ""}
              addressLine1={customer.addressLine1 ?? ""}
              addressLine2={customer.addressLine2 ?? ""}
              addressCity={customer.addressCity ?? ""}
              addressPostcode={customer.addressPostcode ?? ""}
            />
          </section>

          <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-sm font-semibold">
              Notes <span className="font-normal text-muted-foreground">(not visible to customer)</span>
            </h2>
            <CustomerNotesForm customerId={customer.id} notes={customer.adminNotes ?? ""} />
          </section>

          <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-sm font-semibold">Promote to staff</h2>
            <p className="text-sm text-muted-foreground">
              Converts this customer account into a staff or admin login, keeping their existing
              password. You&rsquo;ll be taken to the staff edit page afterwards to add a job title,
              photo, and bio.
            </p>
            <PromoteCustomerForm customerId={customer.id} viewerCanManageAdmins={viewerCanManageAdmins} />
          </section>

          <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-sm font-semibold">Account credit — {formatPence(creditBalancePence)}</h2>
            <GoodwillCreditForm customerId={customer.id} />
          </section>

          <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
            <h2 className="text-sm font-semibold">Dogs ({customer.dogs.length})</h2>
            {customer.dogs.length > 0 ? (
              <ul className="divide-y divide-border text-sm">
                {customer.dogs.map((dog) => {
                  const latestOutcome = dog.trialVisits[0]
                  return (
                    <li key={dog.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        {dog.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/files/${dog.photoUrl}`}
                            alt={dog.name}
                            className="size-14 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">
                            No photo
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {dog.name} <span className="font-normal text-muted-foreground">— {dog.breed}</span>
                          </p>
                          <p className="text-muted-foreground">Added {dog.createdAt.toLocaleDateString("en-GB")}</p>
                        </div>
                      </div>

                      <dl className="grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-3">
                        <div>
                          <dt className="text-xs">Date of birth</dt>
                          <dd className="text-foreground">
                            {dog.dob ? dog.dob.toLocaleDateString("en-GB") : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs">Sex</dt>
                          <dd className="text-foreground capitalize">{dog.sex ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs">Size</dt>
                          <dd className="text-foreground capitalize">
                            {dog.size ? dog.size.toLowerCase() : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs">Weight</dt>
                          <dd className="text-foreground">{dog.weightKg ? `${dog.weightKg} kg` : "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs">Neutered / spayed</dt>
                          <dd className="text-foreground">{dog.neutered ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs">Vet</dt>
                          <dd className="text-foreground">
                            {dog.vetName || "—"}
                            {dog.vetPhone ? ` (${dog.vetPhone})` : ""}
                          </dd>
                        </div>
                        <div className="sm:col-span-3">
                          <dt className="text-xs">Emergency contact</dt>
                          <dd className="text-foreground">{dog.emergencyContact || "—"}</dd>
                        </div>
                        {dog.feedingNotes && (
                          <div className="sm:col-span-3">
                            <dt className="text-xs">Feeding instructions</dt>
                            <dd className="text-foreground">{dog.feedingNotes}</dd>
                          </div>
                        )}
                        {dog.medicationNotes && (
                          <div className="sm:col-span-3">
                            <dt className="text-xs">Medication</dt>
                            <dd className="text-foreground">{dog.medicationNotes}</dd>
                          </div>
                        )}
                        {dog.behaviourNotes && (
                          <div className="sm:col-span-3">
                            <dt className="text-xs">Behavioural notes</dt>
                            <dd className="text-foreground">{dog.behaviourNotes}</dd>
                          </div>
                        )}
                      </dl>

                      <div className="flex flex-wrap items-center gap-2">
                        {latestOutcome ? (
                          <Badge variant={latestOutcome.outcome === "PASSED" ? "default" : "destructive"}>
                            Meet &amp; Greet: {TRIAL_OUTCOME_LABELS[latestOutcome.outcome!]}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Meet &amp; Greet: Not yet done</Badge>
                        )}
                        {dog.vaccinationRecords.length > 0 ? (
                          dog.vaccinationRecords.map((record) => (
                            <Badge
                              key={record.id}
                              variant={
                                record.status === "VERIFIED"
                                  ? "default"
                                  : record.status === "EXPIRED"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {record.type}: {VACCINATION_STATUS_LABELS[record.status]} (exp{" "}
                              {record.expiryDate.toLocaleDateString("en-GB")})
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">No vaccination records</Badge>
                        )}
                      </div>

                      <DogFlagsManager
                        customerId={customer.id}
                        dogId={dog.id}
                        dogName={dog.name}
                        flags={dog.flags}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No dog profiles yet.</p>
            )}
          </section>

          {session?.user.isSuperAdmin && (
            <section className="space-y-3 rounded-lg border border-destructive/50 p-4">
              <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
              <p className="text-sm text-muted-foreground">
                Permanently deletes this customer, all {customer.dogs.length} dog(s), and all{" "}
                {customer.bookings.length} booking(s). This cannot be undone.
              </p>
              <ConfirmDeleteButton
                label="Delete customer"
                title={`Delete ${customer.name}?`}
                description={`This will permanently delete ${customer.name}, their ${customer.dogs.length} dog(s), and their ${customer.bookings.length} booking(s). This cannot be undone.`}
                onConfirm={deleteCustomer.bind(null, customer.id)}
              />
            </section>
          )}
        </div>

        <div className="space-y-5 rounded-lg border border-border p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="font-semibold text-primary">{formatPence(revenuePence)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bookings</p>
              <p className="font-semibold">{customer.bookings.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className={`font-semibold ${outstandingPence > 0 ? "text-destructive" : ""}`}>
                {formatPence(outstandingPence)}
              </p>
            </div>
          </div>

          <section className="space-y-2 rounded-lg border border-blue-200 bg-blue-100 p-4">
            <h2 className="text-sm font-semibold">
              Next {upcomingBookings.length} booking{upcomingBookings.length === 1 ? "" : "s"}
            </h2>
            {upcomingBookings.length > 0 ? (
              <ul className="divide-y divide-border">
                {upcomingBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming bookings.</p>
            )}
          </section>

          {pastBookings.length > 0 && (
            <details className="rounded-lg border border-blue-200 bg-blue-100 p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                Previous {pastBookings.length} booking{pastBookings.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 divide-y divide-border">
                {pastBookings.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} />
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <Link href="/admin/customers" className="inline-block text-sm font-medium text-primary hover:underline">
        ← Back to customers
      </Link>
    </div>
  )
}
