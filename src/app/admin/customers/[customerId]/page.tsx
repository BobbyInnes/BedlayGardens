import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { formatPence } from "@/lib/format"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { CustomerNotesForm } from "@/components/admin/customer-notes-form"
import { DogFlagsManager } from "@/components/admin/dog-flags-manager"
import { GoodwillCreditForm } from "@/components/admin/goodwill-credit-form"
import { toggleCustomerActive } from "@/app/admin/customers/actions"
import { getAvailableCreditPence } from "@/lib/vouchers"

export const metadata: Metadata = {
  title: "Customer | Admin",
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: "CUSTOMER" },
    include: {
      dogs: { orderBy: { name: "asc" }, include: { flags: true } },
      bookings: {
        orderBy: { startDate: "desc" },
        include: { service: true },
        take: 50,
      },
    },
  })
  if (!customer) notFound()
  const creditBalancePence = await getAvailableCreditPence(customer.id)

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={customer.active ? "secondary" : "destructive"}>
            {customer.active ? "Active" : "Banned"}
          </Badge>
          <ToggleActiveButton
            active={customer.active}
            onToggle={toggleCustomerActive.bind(null, customer.id)}
          />
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Admin notes</h2>
        <CustomerNotesForm customerId={customer.id} notes={customer.adminNotes ?? ""} />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">
          Account credit — {formatPence(creditBalancePence)}
        </h2>
        <GoodwillCreditForm customerId={customer.id} />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Dogs ({customer.dogs.length})</h2>
        {customer.dogs.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {customer.dogs.map((dog) => (
              <li key={dog.id} className="space-y-2 py-3">
                <p className="font-medium">
                  {dog.name} <span className="font-normal text-muted-foreground">— {dog.breed}</span>
                </p>
                <DogFlagsManager
                  customerId={customer.id}
                  dogId={dog.id}
                  dogName={dog.name}
                  flags={dog.flags}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No dog profiles yet.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Booking history ({customer.bookings.length})</h2>
        {customer.bookings.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {customer.bookings.map((booking) => (
              <li key={booking.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/bookings/${booking.id}`} className="hover:underline">
                  <span className="font-medium">{booking.service.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {booking.startDate.toLocaleDateString("en-GB")}
                    {booking.endDate.getTime() !== booking.startDate.getTime()
                      ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
                      : ""}
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  <span>{formatPence(booking.totalPence)}</span>
                  <Badge variant="outline">{booking.status.replace(/_/g, " ")}</Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        )}
      </section>

      <Link href="/admin/customers" className="inline-block text-sm font-medium text-primary hover:underline">
        ← Back to customers
      </Link>
    </div>
  )
}
