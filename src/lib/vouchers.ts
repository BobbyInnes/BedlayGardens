import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"

export function generateVoucherCode(): string {
  return randomBytes(4).toString("hex").toUpperCase()
}

export async function getAvailableCreditPence(customerId: string): Promise<number> {
  const result = await prisma.creditLedger.aggregate({
    where: { customerId },
    _sum: { amountPence: true },
  })
  return result._sum.amountPence ?? 0
}

export type RedemptionResult = { ok: true; appliedPence: number } | { ok: false; message: string }

/**
 * Applies a voucher code or the customer's account credit to a specific
 * charge (deposit or balance). Only succeeds when the available balance
 * fully covers `amountDuePence` — mixing a partial credit redemption with a
 * card payment for the remainder isn't wired into Stripe checkout (a
 * deliberate scope simplification). When a voucher's balance exceeds the
 * charge, the leftover is converted to account credit (`CreditLedger`),
 * matching "partial redemption leaves account credit".
 */
export async function redeemForCharge(
  customerId: string,
  bookingId: string,
  amountDuePence: number,
  code?: string
): Promise<RedemptionResult> {
  if (amountDuePence <= 0) return { ok: false, message: "Nothing due." }

  if (code) {
    const voucher = await prisma.voucher.findUnique({ where: { code: code.trim().toUpperCase() } })
    if (!voucher || voucher.status !== "ACTIVE") {
      return { ok: false, message: "Voucher code not found or inactive." }
    }
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      return { ok: false, message: "This voucher has expired." }
    }
    if (voucher.remainingPence < amountDuePence) {
      return {
        ok: false,
        message: `This voucher only covers ${formatPence(voucher.remainingPence)} — not enough for the ${formatPence(amountDuePence)} due. Try a smaller charge, or pay the rest by card.`,
      }
    }

    const leftover = voucher.remainingPence - amountDuePence
    await prisma.$transaction([
      prisma.voucher.update({ where: { id: voucher.id }, data: { remainingPence: 0, status: "REDEEMED" } }),
      ...(leftover > 0
        ? [
            prisma.creditLedger.create({
              data: { customerId, amountPence: leftover, reason: `Unused balance from voucher ${voucher.code}` },
            }),
          ]
        : []),
    ])
    return { ok: true, appliedPence: amountDuePence }
  }

  const available = await getAvailableCreditPence(customerId)
  if (available < amountDuePence) {
    return {
      ok: false,
      message: `You only have ${formatPence(available)} of account credit — not enough to cover ${formatPence(amountDuePence)}.`,
    }
  }

  await prisma.creditLedger.create({
    data: { customerId, amountPence: -amountDuePence, reason: "Applied to booking", bookingId },
  })
  return { ok: true, appliedPence: amountDuePence }
}
