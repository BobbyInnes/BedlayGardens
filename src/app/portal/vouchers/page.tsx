import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { VoucherPurchaseForm } from "@/components/portal/voucher-purchase-form"
import { getAvailableCreditPence, getGiftCardPresetAmounts, getGiftCardAmountLimits } from "@/lib/vouchers"

export const metadata: Metadata = {
  title: "Gift Cards & Credit",
}

// Gift Cards is removed from the customer portal for now (nav entry pulled
// too — see portal-nav.tsx). Underlying code left in place so this is easy
// to re-enable later; direct URL access redirects to the dashboard.
const FEATURE_ENABLED = false

export default async function PortalVouchersPage() {
  if (!FEATURE_ENABLED) redirect("/portal")

  const session = await auth()
  const [creditBalancePence, purchased, presetAmounts, amountLimits] = await Promise.all([
    getAvailableCreditPence(session!.user.id),
    prisma.voucher.findMany({ where: { purchaserId: session!.user.id }, orderBy: { id: "desc" } }),
    getGiftCardPresetAmounts(),
    getGiftCardAmountLimits(),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gift Cards & Credit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buy a gift card for yourself or someone else — redeem it (or any account credit) against
          a booking&rsquo;s deposit or balance from the Bookings page.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">Your account credit balance</p>
        <p className="text-2xl font-semibold">{formatPence(creditBalancePence)}</p>
      </div>

      <VoucherPurchaseForm presetAmounts={presetAmounts} {...amountLimits} />

      {purchased.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Gift cards you&rsquo;ve purchased</h2>
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
