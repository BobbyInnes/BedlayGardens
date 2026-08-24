import { getSettings } from "@/lib/settings"
import { toDateInputValue } from "@/lib/dates"

export type VatPeriodLength = "MONTHLY" | "QUARTERLY" | "ANNUALLY"

export type VatSettings = {
  enabled: boolean
  number: string
  ratePercent: number
  periodStartMonth: number // 1-12
  periodLength: VatPeriodLength
}

const PERIOD_MONTHS: Record<VatPeriodLength, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUALLY: 12,
}

export const VAT_PERIOD_LENGTH_LABELS: Record<VatPeriodLength, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUALLY: "Annually",
}

function parsePeriodLength(value: string | undefined): VatPeriodLength {
  return value === "MONTHLY" || value === "QUARTERLY" || value === "ANNUALLY" ? value : "QUARTERLY"
}

export async function getVatSettings(): Promise<VatSettings> {
  const settings = await getSettings()
  const ratePercent = Number(settings.vat_rate_percent)
  const periodStartMonth = Number(settings.vat_period_start_month)
  return {
    enabled: settings.vat_enabled === "true",
    number: settings.vat_number ?? "",
    ratePercent: Number.isFinite(ratePercent) && ratePercent > 0 ? ratePercent : 20,
    periodStartMonth:
      Number.isFinite(periodStartMonth) && periodStartMonth >= 1 && periodStartMonth <= 12
        ? periodStartMonth
        : 1,
    periodLength: parsePeriodLength(settings.vat_period_length),
  }
}

/** Prices are treated as VAT-inclusive — this extracts the net/VAT split from a gross amount. */
export function splitGrossForVat(
  grossPence: number,
  vat: Pick<VatSettings, "enabled" | "ratePercent">
): { netPence: number; vatPence: number } {
  if (!vat.enabled || vat.ratePercent <= 0) return { netPence: grossPence, vatPence: 0 }
  const netPence = Math.round(grossPence / (1 + vat.ratePercent / 100))
  return { netPence, vatPence: grossPence - netPence }
}

export type VatPeriod = { start: Date; end: Date }

/** The VAT period (inclusive start, exclusive end) containing `date`, anchored on `startMonth`/`length`. */
export function vatPeriodContaining(date: Date, startMonth: number, length: VatPeriodLength): VatPeriod {
  const monthsPerPeriod = PERIOD_MONTHS[length]
  const anchor = startMonth - 1 // 0-based
  const absoluteMonth = date.getFullYear() * 12 + date.getMonth()
  const offset = ((absoluteMonth - anchor) % monthsPerPeriod + monthsPerPeriod) % monthsPerPeriod
  const periodStartAbsolute = absoluteMonth - offset
  const start = new Date(Math.floor(periodStartAbsolute / 12), periodStartAbsolute % 12, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + monthsPerPeriod, 1)
  return { start, end }
}

export function adjacentVatPeriod(
  period: VatPeriod,
  direction: "prev" | "next",
  startMonth: number,
  length: VatPeriodLength
): VatPeriod {
  const monthsPerPeriod = PERIOD_MONTHS[length]
  const reference = new Date(period.start)
  reference.setMonth(reference.getMonth() + (direction === "next" ? monthsPerPeriod : -monthsPerPeriod))
  return vatPeriodContaining(reference, startMonth, length)
}

export function formatVatPeriod(period: VatPeriod): string {
  const end = new Date(period.end)
  end.setDate(end.getDate() - 1) // display as inclusive end date
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
  return `${period.start.toLocaleDateString("en-GB", opts)} – ${end.toLocaleDateString("en-GB", opts)}`
}

// `period.start` is built from local date components (see vatPeriodContaining),
// so this must format it in local time too — a naive `toISOString().slice(0, 10)`
// converts to UTC first and reads one day early whenever local time is ahead
// of UTC (e.g. BST), which can corrupt the date enough to land in the wrong
// period entirely once it's re-parsed. Same footgun toDateInputValue already
// avoids, so it's reused here rather than duplicating the fix.
export function vatPeriodParam(period: VatPeriod): string {
  return toDateInputValue(period.start)
}
