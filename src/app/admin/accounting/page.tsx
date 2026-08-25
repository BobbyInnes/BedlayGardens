import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPence, fullName } from "@/lib/format"
import { formatCustomerNumber } from "@/lib/customer-dog-numbers"
import { getVatSettings, vatPeriodContaining, adjacentVatPeriod, formatVatPeriod, vatPeriodParam, splitGrossForVat } from "@/lib/vat"
import type { PaymentStatus } from "@/generated/prisma/client"

export const metadata: Metadata = {
  title: "Accounting | Admin",
}

const STATUS_OPTIONS: PaymentStatus[] = ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]

// Pulls a customer number out of a search string typed as "CUST-00019",
// "00019", or plain "19" — all extract to the same digits. Returns null for
// a query with no digits at all, so a plain name/email search is untouched.
function digitsOf(value: string): number | null {
  const digits = value.trim().replace(/\D/g, "")
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}

function formatDateTime(date: Date | null): string {
  if (!date) return "—"
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type SortColumn = "booking" | "customerNumber" | "raised" | "paid"

function isSortColumn(value: string): value is SortColumn {
  return value === "booking" || value === "customerNumber" || value === "raised" || value === "paid"
}

export default async function AdminAccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; status?: string; q?: string; booking?: string; sort?: string; dir?: string }>
}) {
  const {
    period: periodParam,
    status: statusParam = "",
    q = "",
    booking: bookingNumber = "",
    sort: sortParam = "",
    dir: dirParam = "",
  } = await searchParams
  const status = statusParam === "ALL" ? "" : statusParam
  // No explicit sort means "Raised, newest first" — the table's original
  // default — so that's the implicit starting state rather than a separate
  // "unsorted" state, and clicking "Raised" from a fresh page toggles to
  // oldest-first instead of appearing to do nothing.
  const sortColumn: SortColumn = isSortColumn(sortParam) ? sortParam : "raised"
  const sortDir: "asc" | "desc" =
    dirParam === "asc" || dirParam === "desc" ? dirParam : sortColumn === "raised" ? "desc" : "asc"

  const vat = await getVatSettings()
  const referenceDate = periodParam ? new Date(periodParam) : new Date()
  const period = vatPeriodContaining(
    Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate,
    vat.periodStartMonth,
    vat.periodLength
  )
  const prevPeriod = adjacentVatPeriod(period, "prev", vat.periodStartMonth, vat.periodLength)
  const nextPeriod = adjacentVatPeriod(period, "next", vat.periodStartMonth, vat.periodLength)

  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { createdAt: { gte: period.start, lt: period.end } },
        { succeededAt: { gte: period.start, lt: period.end } },
      ],
      ...(status ? { status: status as PaymentStatus } : {}),
      ...(q.trim()
        ? {
            booking: {
              customer: {
                OR: [
                  { forename: { contains: q.trim(), mode: "insensitive" } },
                  { surname: { contains: q.trim(), mode: "insensitive" } },
                  { email: { contains: q.trim(), mode: "insensitive" } },
                  // Also matches a customer number typed into this field —
                  // "CUST-00019", "00019", or plain "19" all extract to the
                  // same digits, so any of those forms works.
                  ...(digitsOf(q) !== null ? [{ customerNumber: digitsOf(q)! }] : []),
                ],
              },
            },
          }
        : {}),
      // The "Booking" column shows the id's last 6 characters — matching by
      // endsWith (case-insensitive) accepts that short code as well as a
      // full id someone might paste in from a URL.
      ...(bookingNumber.trim() ? { bookingId: { endsWith: bookingNumber.trim(), mode: "insensitive" } } : {}),
    },
    include: {
      booking: {
        include: {
          customer: true,
          service: true,
          payments: true,
          bookingDogs: { include: { dog: true } },
        },
      },
    },
    orderBy:
      sortColumn === "booking"
        ? { bookingId: sortDir }
        : sortColumn === "customerNumber"
          ? { booking: { customer: { customerNumber: sortDir } } }
          : sortColumn === "paid"
            ? { succeededAt: sortDir }
            : { createdAt: sortDir },
    take: 200,
  })

  let periodNetPence = 0
  let periodVatPence = 0
  let periodGrossPence = 0
  for (const payment of payments) {
    if (payment.status !== "SUCCEEDED" || !payment.succeededAt) continue
    if (payment.succeededAt < period.start || payment.succeededAt >= period.end) continue
    const gross = payment.type === "REFUND" ? -payment.amountPence : payment.amountPence
    const { netPence, vatPence } = splitGrossForVat(gross, vat)
    periodNetPence += netPence
    periodVatPence += vatPence
    periodGrossPence += gross
  }

  const exportParams = new URLSearchParams()
  exportParams.set("period", vatPeriodParam(period))
  if (status) exportParams.set("status", status)
  if (q.trim()) exportParams.set("q", q.trim())
  if (bookingNumber.trim()) exportParams.set("booking", bookingNumber.trim())

  // Clicking an unsorted column starts it ascending; clicking the column
  // that's already active flips its direction. Every other filter carries
  // over unchanged (built from exportParams, which already has them).
  function sortHref(column: SortColumn): string {
    const nextDir = sortColumn === column && sortDir === "asc" ? "desc" : "asc"
    const params = new URLSearchParams(exportParams)
    params.set("sort", column)
    params.set("dir", nextDir)
    return `/admin/accounting?${params.toString()}`
  }

  function sortIndicator(column: SortColumn): string {
    if (sortColumn !== column) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every payment transaction — raised, paid, and outstanding — with a VAT split based on
          the rate set in Content.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/admin/accounting?${new URLSearchParams({ ...Object.fromEntries(exportParams), period: vatPeriodParam(prevPeriod) })}`}
            className="font-medium text-primary hover:underline"
          >
            ← Prev period
          </Link>
          <span className="font-medium">
            {formatVatPeriod(period)} ({vat.periodLength.toLowerCase()})
          </span>
          <Link
            href={`/admin/accounting?${new URLSearchParams({ ...Object.fromEntries(exportParams), period: vatPeriodParam(nextPeriod) })}`}
            className="font-medium text-primary hover:underline"
          >
            Next period →
          </Link>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="font-semibold">{formatPence(periodNetPence)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              VAT collected{vat.number ? ` (${vat.number})` : ""}
            </p>
            <p className="font-semibold">{formatPence(periodVatPence)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gross</p>
            <p className="font-semibold">{formatPence(periodGrossPence)}</p>
          </div>
        </div>
      </div>
      {!vat.enabled && (
        <p className="text-sm text-muted-foreground">
          VAT isn&rsquo;t enabled (Pricing &amp; Capacity) — net/gross are shown equal and VAT as £0
          until it&rsquo;s turned on.
        </p>
      )}

      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="period" value={vatPeriodParam(period)} />
        <div className="space-y-2">
          <Label htmlFor="q">Customer name, email, or number</Label>
          <Input id="q" name="q" defaultValue={q} className="w-64" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking">Booking number</Label>
          <Input id="booking" name="booking" defaultValue={bookingNumber} className="w-32" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Payment status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status || "ALL"}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="ALL">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/admin/accounting/export?${exportParams.toString()}`}>Export CSV</a>
        </Button>
      </form>

      {payments.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-3 font-medium">
                  <Link href={sortHref("booking")} className="hover:underline">
                    Booking{sortIndicator("booking")}
                  </Link>
                </th>
                <th className="p-3 font-medium">
                  <Link href={sortHref("raised")} className="hover:underline">
                    Raised{sortIndicator("raised")}
                  </Link>
                </th>
                <th className="p-3 font-medium">
                  <Link href={sortHref("paid")} className="hover:underline">
                    Paid{sortIndicator("paid")}
                  </Link>
                </th>
                <th className="p-3 font-medium">Customer</th>
                <th className="p-3 font-medium">
                  <Link href={sortHref("customerNumber")} className="hover:underline">
                    Customer number{sortIndicator("customerNumber")}
                  </Link>
                </th>
                <th className="p-3 font-medium">Dog(s)</th>
                <th className="p-3 font-medium">Service</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 text-right font-medium">Net</th>
                <th className="p-3 text-right font-medium">VAT</th>
                <th className="p-3 text-right font-medium">Gross</th>
                <th className="p-3 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => {
                const gross = payment.type === "REFUND" ? -payment.amountPence : payment.amountPence
                const { netPence, vatPence } = splitGrossForVat(gross, vat)
                const paidPence = payment.booking.payments
                  .filter((p) => p.type !== "REFUND" && p.status === "SUCCEEDED")
                  .reduce((sum, p) => sum + p.amountPence, 0)
                const outstandingPence = payment.booking.totalPence - paidPence
                return (
                  <tr key={payment.id}>
                    <td className="p-3 whitespace-nowrap">
                      <Link
                        href={`/admin/bookings/${payment.bookingId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {payment.bookingId.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(payment.createdAt)}
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(payment.succeededAt)}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/admin/bookings/${payment.bookingId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {fullName(payment.booking.customer)}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {formatCustomerNumber(payment.booking.customer.customerNumber)}
                    </td>
                    <td className="p-3">
                      {payment.booking.bookingDogs.map((bd) => bd.dog.name).join(", ") || "—"}
                    </td>
                    <td className="p-3">{payment.booking.service.name}</td>
                    <td className="p-3">{payment.type}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          payment.status === "SUCCEEDED"
                            ? "default"
                            : payment.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">{formatPence(netPence)}</td>
                    <td className="p-3 text-right">{formatPence(vatPence)}</td>
                    <td className="p-3 text-right font-medium">{formatPence(gross)}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatPence(outstandingPence)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No transactions in this period matching your filters.</p>
      )}
    </div>
  )
}
