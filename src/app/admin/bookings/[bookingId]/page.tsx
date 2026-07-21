import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { formatPence } from "@/lib/format"
import { toDateInputValue } from "@/lib/dates"
import { BookingDatesForm } from "@/components/admin/booking-dates-form"
import { CancelBookingAdminButton } from "@/components/admin/cancel-booking-admin-button"
import { ReassignKennelForm } from "@/components/admin/reassign-kennel-form"
import { RecordManualPaymentForm } from "@/components/admin/record-manual-payment-form"
import { SendInvoiceButton } from "@/components/admin/send-invoice-button"

export const metadata: Metadata = {
  title: "Booking | Admin",
}

const NON_MODIFIABLE_STATUSES = [
  "CHECKED_IN",
  "CHECKED_OUT",
  "COMPLETED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      service: true,
      kennelUnit: true,
      bookingDogs: { include: { dog: true } },
      bookingAddons: { include: { addon: true } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!booking) notFound()

  const modifiable = !NON_MODIFIABLE_STATUSES.includes(booking.status)
  const balancePence = booking.totalPence - booking.depositPence
  const isBoarding = booking.service.slug === "overnight-boarding"
  const depositPaid = booking.payments.some((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED")
  const balancePaid = booking.payments.some((p) => p.type === "BALANCE" && p.status === "SUCCEEDED")
  const CANCELLED_STATUSES = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "NO_SHOW"]
  const canRecordPayment = !CANCELLED_STATUSES.includes(booking.status)
  const isInvoiceAfter = booking.service.paymentTiming === "INVOICE_AFTER"
  const pendingInvoice = booking.payments.find(
    (p) => p.type === "INVOICE" && p.status === "PENDING"
  )
  const invoiceSettled = booking.payments.some(
    (p) => p.type === "INVOICE" && p.status === "SUCCEEDED"
  )

  const kennelUnits = isBoarding
    ? await prisma.kennelUnit.findMany({
        where: { active: true, dogCapacity: { gte: booking.bookingDogs.length } },
        orderBy: { name: "asc" },
      })
    : []

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{booking.service.name}</h1>
          <p className="text-sm text-muted-foreground">
            {booking.customer.name} ({booking.customer.email})
          </p>
        </div>
        <Badge variant="secondary">{booking.status.replace(/_/g, " ")}</Badge>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Stay details</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Dates</dt>
            <dd>
              {booking.startDate.toLocaleDateString("en-GB")}
              {booking.endDate.getTime() !== booking.startDate.getTime()
                ? ` – ${booking.endDate.toLocaleDateString("en-GB")}`
                : ""}
            </dd>
          </div>
          {booking.kennelUnit && (
            <div>
              <dt className="text-muted-foreground">Accommodation</dt>
              <dd>{booking.kennelUnit.name}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Dogs</dt>
            <dd>{booking.bookingDogs.map((bd) => bd.dog.name).join(", ")}</dd>
          </div>
          {booking.bookingAddons.length > 0 && (
            <div>
              <dt className="text-muted-foreground">Add-ons</dt>
              <dd>
                {booking.bookingAddons.map((ba) => `${ba.addon.name} × ${ba.quantity}`).join(", ")}
              </dd>
            </div>
          )}
          {booking.customer.phone && (
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{booking.customer.phone}</dd>
            </div>
          )}
          {booking.cancellationReason && (
            <div>
              <dt className="text-muted-foreground">Cancellation reason</dt>
              <dd>{booking.cancellationReason}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Payment</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium">{formatPence(booking.totalPence)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deposit</dt>
            <dd>{formatPence(booking.depositPence)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Balance</dt>
            <dd>{formatPence(balancePence)}</dd>
          </div>
        </dl>
        {booking.payments.length > 0 ? (
          <ul className="divide-y divide-border text-sm">
            {booking.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between py-2">
                <span>
                  {payment.type} — {payment.createdAt.toLocaleDateString("en-GB")}
                </span>
                <span className="flex items-center gap-2">
                  {formatPence(payment.amountPence)}
                  <Badge variant="outline">{payment.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        )}
        {canRecordPayment && !isInvoiceAfter && !depositPaid && (
          <RecordManualPaymentForm bookingId={booking.id} type="DEPOSIT" label="deposit" />
        )}
        {canRecordPayment &&
          !isInvoiceAfter &&
          booking.status === "CONFIRMED" &&
          !balancePaid &&
          balancePence > 0 && (
            <RecordManualPaymentForm bookingId={booking.id} type="BALANCE" label="balance" />
          )}
        {isInvoiceAfter &&
          ["CHECKED_OUT", "COMPLETED"].includes(booking.status) &&
          !invoiceSettled && (
            <div className="space-y-2">
              {pendingInvoice?.hostedInvoiceUrl && (
                <p className="text-xs text-muted-foreground">
                  Invoice outstanding —{" "}
                  <a
                    href={pendingInvoice.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    view hosted invoice
                  </a>
                </p>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <SendInvoiceButton
                  bookingId={booking.id}
                  label={pendingInvoice ? "Resend invoice email" : "Send invoice"}
                />
                {pendingInvoice && (
                  <RecordManualPaymentForm bookingId={booking.id} type="INVOICE" label="invoice" />
                )}
              </div>
            </div>
          )}
      </section>

      {modifiable && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Modify dates</h2>
          <BookingDatesForm
            bookingId={booking.id}
            serviceSlug={booking.service.slug}
            startDate={toDateInputValue(booking.startDate)}
            endDate={toDateInputValue(booking.endDate)}
          />
        </section>
      )}

      {modifiable && isBoarding && booking.kennelUnit && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Reassign accommodation</h2>
          <ReassignKennelForm
            bookingId={booking.id}
            currentKennelUnitId={booking.kennelUnit.id}
            kennelUnits={kennelUnits}
          />
        </section>
      )}

      {modifiable && (
        <section className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <h2 className="text-sm font-semibold">Cancel booking</h2>
          <CancelBookingAdminButton bookingId={booking.id} />
        </section>
      )}

      <Link href="/admin/bookings" className="inline-block text-sm font-medium text-primary hover:underline">
        ← Back to bookings
      </Link>
    </div>
  )
}
