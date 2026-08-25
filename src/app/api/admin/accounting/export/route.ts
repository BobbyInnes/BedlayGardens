import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getVatSettings, vatPeriodContaining, splitGrossForVat } from "@/lib/vat"
import { formatCustomerNumber } from "@/lib/customer-dog-numbers"
import { fullName } from "@/lib/format"
import type { PaymentStatus } from "@/generated/prisma/client"

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

// Pulls a customer number out of a search string typed as "CUST-00019",
// "00019", or plain "19" — all extract to the same digits. Returns null for
// a query with no digits at all, so a plain name/email search is untouched.
// Kept in sync with the same helper in the accounting page.
function digitsOf(value: string): number | null {
  const digits = value.trim().replace(/\D/g, "")
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}

const MAX_EXPORT_ROWS = 5000

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const periodParam = searchParams.get("period")
  const status = searchParams.get("status")
  const q = searchParams.get("q")?.trim()
  const bookingNumber = searchParams.get("booking")?.trim()

  const vat = await getVatSettings()
  const referenceDate = periodParam ? new Date(periodParam) : new Date()
  const period = vatPeriodContaining(
    Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate,
    vat.periodStartMonth,
    vat.periodLength
  )

  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { createdAt: { gte: period.start, lt: period.end } },
        { succeededAt: { gte: period.start, lt: period.end } },
      ],
      ...(status && status !== "ALL" ? { status: status as PaymentStatus } : {}),
      ...(q
        ? {
            booking: {
              customer: {
                OR: [
                  { forename: { contains: q, mode: "insensitive" } },
                  { surname: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  ...(digitsOf(q) !== null ? [{ customerNumber: digitsOf(q)! }] : []),
                ],
              },
            },
          }
        : {}),
      ...(bookingNumber ? { bookingId: { endsWith: bookingNumber, mode: "insensitive" } } : {}),
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
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
  })

  const header = [
    "Date raised",
    "Date paid",
    "Customer",
    "Customer number",
    "Email",
    "Dog(s)",
    "Service",
    "Type",
    "Status",
    "Net (GBP)",
    "VAT (GBP)",
    "Gross (GBP)",
    "Deposit (GBP)",
    "Outstanding (GBP)",
  ]

  const rows = payments.map((payment) => {
    const gross = payment.type === "REFUND" ? -payment.amountPence : payment.amountPence
    const { netPence, vatPence } = splitGrossForVat(gross, vat)
    const paidPence = payment.booking.payments
      .filter((p) => p.type !== "REFUND" && p.status === "SUCCEEDED")
      .reduce((sum, p) => sum + p.amountPence, 0)
    const outstandingPence = payment.booking.totalPence - paidPence

    return [
      payment.createdAt.toISOString(),
      payment.succeededAt ? payment.succeededAt.toISOString() : "",
      fullName(payment.booking.customer),
      formatCustomerNumber(payment.booking.customer.customerNumber),
      payment.booking.customer.email,
      payment.booking.bookingDogs.map((bd) => bd.dog.name).join(", "),
      payment.booking.service.name,
      payment.type,
      payment.status,
      (netPence / 100).toFixed(2),
      (vatPence / 100).toFixed(2),
      (gross / 100).toFixed(2),
      (payment.booking.depositPence / 100).toFixed(2),
      (outstandingPence / 100).toFixed(2),
    ]
  })

  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n")
  const timestamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accounting-${timestamp}.csv"`,
    },
  })
}
