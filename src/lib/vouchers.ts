import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { formatPence } from "@/lib/format"
import { getSettings } from "@/lib/settings"

export function generateVoucherCode(): string {
  return randomBytes(4).toString("hex").toUpperCase()
}

const DEFAULT_GIFT_CARD_PRESET_AMOUNTS = [25, 50, 100]
const DEFAULT_GIFT_CARD_MIN_AMOUNT = 5
const DEFAULT_GIFT_CARD_MAX_AMOUNT = 1000

/** Admin-configurable (Settings) preset amounts shown as quick-pick buttons, in pounds. */
export async function getGiftCardPresetAmounts(): Promise<number[]> {
  const settings = await getSettings()
  const raw = settings.gift_card_preset_amounts
  if (!raw) return DEFAULT_GIFT_CARD_PRESET_AMOUNTS
  const parsed = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0)
  return parsed.length > 0 ? parsed : DEFAULT_GIFT_CARD_PRESET_AMOUNTS
}

/** Admin-configurable (Settings) min/max a gift card purchase can be, in pounds. */
export async function getGiftCardAmountLimits(): Promise<{ minAmount: number; maxAmount: number }> {
  const settings = await getSettings()
  const min = Number(settings.gift_card_min_amount)
  const max = Number(settings.gift_card_max_amount)
  return {
    minAmount: Number.isFinite(min) && min > 0 ? min : DEFAULT_GIFT_CARD_MIN_AMOUNT,
    maxAmount: Number.isFinite(max) && max > 0 ? max : DEFAULT_GIFT_CARD_MAX_AMOUNT,
  }
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
