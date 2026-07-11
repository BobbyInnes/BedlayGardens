import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { VoucherPurchaseForm } from "@/components/portal/voucher-purchase-form"
import { getAvailableCreditPence } from "@/lib/vouchers"

export const metadata: Metadata = {
  title: "Vouchers & Credit",
}

export default async function PortalVouchersPage() {
  const session = await auth()
  const [creditBalancePence, purchased] = await Promise.all([
    getAvailableCreditPence(session!.user.id),
    prisma.voucher.findMany({ where: { purchaserId: session!.user.id }, orderBy: { id: "desc" } }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vouchers & Credit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buy a gift voucher for yourself or someone else — redeem it (or any account credit) against
          a booking&rsquo;s deposit or balance from the Bookings page.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Your account credit balance</p>
        <p className="text-2xl font-semibold">{formatPence(creditBalancePence)}</p>
      </div>

      <VoucherPurchaseForm />

      {purchased.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Vouchers you&rsquo;ve purchased</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {purchased.map((voucher) => (
              <li key={voucher.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{voucher.status === "PENDING" ? "Processing…" : voucher.code}</p>
                  <p className="text-muted-foreground">
                    {formatPence(voucher.remainingPence)} of {formatPence(voucher.amountPence)} remaining
                    {voucher.recipientEmail ? ` — sent to ${voucher.recipientEmail}` : ""}
                  </p>
                </div>
                <span className="text-muted-foreground capitalize">{voucher.status.toLowerCase()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
