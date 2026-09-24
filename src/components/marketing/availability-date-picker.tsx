"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { isSameDayBookingBlocked } from "@/lib/service-slugs"
import { earliestCustomerBookableDateISO, isPastNextDayBookingCutoff } from "@/lib/dates"
import type { WalkType } from "@/generated/prisma/client"

// NOT src/lib/dates.ts's toDateInputValue — that one deliberately reads UTC
// components, because every Date elsewhere in the app is a UTC-midnight
// instant (see the note on it). A day-picker cell Date is the opposite: the
// underlying calendar library builds it as LOCAL midnight for that calendar
// day. Reading UTC components off a local-midnight Date shifts by a day
// whenever the browser's UTC offset isn't zero (e.g. BST, UTC+1) — bug found
// 2026-09-10: every cell one day out of sync with the server's `available`
// set, and picking a day selected the day before it. Local components are
// the correct read here; the resulting "YYYY-MM-DD" string is still exactly
// what the server expects (a bare date string parses as UTC midnight).
function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type BaseProps = {
  serviceSlug: "dayfull" | "dayhalf" | "meet-greet" | "walkgroup" | "walksolo"
  walkType?: WalkType
}
type SingleProps = BaseProps & { mode?: "single"; value: string; onChange: (value: string) => void }
type MultipleProps = BaseProps & { mode: "multiple"; value: string[]; onChange: (value: string[]) => void }

/**
 * Date-based booking step (daycare / meet & greet / dog walking) picker.
 * Circles every weekday in the visible month that's actually available,
 * fetched in one batch per month rather than checking day by day — the
 * highlight is just a guide though, not the final word: whatever day(s) get
 * picked are re-verified again at booking creation, since someone else could
 * book one in between.
 *
 * `mode="multiple"` lets daycare/dog-walking bookings cover several dates in
 * one go — each still becomes its own booking server-side, this just lets
 * the customer pick them all up front. Meet & Greet stays single-mode since
 * only one can happen per day anyway. For dog walking, pass `walkType` too —
 * capacity (and so the highlight) differs per type.
 */
export function AvailabilityDatePicker(props: SingleProps | MultipleProps) {
  const { serviceSlug, walkType } = props
  const multiple = props.mode === "multiple"

  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date>(() => {
    const first = multiple ? props.value[0] : props.value
    return first ? new Date(`${first}T00:00:00`) : new Date()
  })
  const [availableDays, setAvailableDays] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    let cancelled = false
    const monthParam = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
    const walkTypeParam = walkType ? `&walkType=${walkType}` : ""
    fetch(`/api/book/availability-month?serviceSlug=${serviceSlug}&month=${monthParam}${walkTypeParam}`)
      .then((res) => res.json())
      .then((data: { available?: string[] }) => {
        if (!cancelled) setAvailableDays(new Set(data.available ?? []))
      })
      .catch(() => {
        if (!cancelled) setAvailableDays(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [serviceSlug, walkType, month])

  // Day Care and Dog Walking can't be booked for the current day, and from
  // 10pm UK time tomorrow closes too — so their earliest selectable date is
  // tomorrow, or the day after tomorrow once it's past 10pm (everything
  // before it is greyed out). Meet & Greet can still be booked from today.
  // The earliest date is worked out on the UK clock by the shared helper (the
  // same one the server enforces), then turned into a local-midnight Date to
  // match the day-picker's cells.
  const blocksSameDay = isSameDayBookingBlocked(serviceSlug)
  const pastCutoff = blocksSameDay && isPastNextDayBookingCutoff()
  const earliest = blocksSameDay
    ? new Date(`${earliestCustomerBookableDateISO()}T00:00:00`)
    : (() => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d
      })()
  const isAvailableDay = (date: Date) =>
    date >= earliest && availableDays.has(toLocalDateInputValue(date))

  const triggerLabel = multiple
    ? props.value.length === 0
      ? "Select dates"
      : props.value.length === 1
        ? new Date(`${props.value[0]}T00:00:00`).toLocaleDateString("en-GB")
        : `${props.value.length} dates selected`
    : props.value
      ? new Date(`${props.value}T00:00:00`).toLocaleDateString("en-GB")
      : "Select a date"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {multiple ? (
          <Calendar
            mode="multiple"
            selected={props.value.map((v) => new Date(`${v}T00:00:00`))}
            month={month}
            onMonthChange={setMonth}
            disabled={[{ before: earliest }, { dayOfWeek: [0, 6] }]}
            modifiers={{ available: isAvailableDay }}
            modifiersClassNames={{ available: "ring-2 ring-primary ring-inset rounded-full" }}
            onSelect={(dates) => props.onChange((dates ?? []).map(toLocalDateInputValue).sort())}
          />
        ) : (
          <Calendar
            mode="single"
            selected={props.value ? new Date(`${props.value}T00:00:00`) : undefined}
            month={month}
            onMonthChange={setMonth}
            disabled={[{ before: earliest }, { dayOfWeek: [0, 6] }]}
            modifiers={{ available: isAvailableDay }}
            modifiersClassNames={{ available: "ring-2 ring-primary ring-inset rounded-full" }}
            onSelect={(date) => {
              if (date) {
                props.onChange(toLocalDateInputValue(date))
                setOpen(false)
              }
            }}
          />
        )}
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Circled days have space available.
          {blocksSameDay
            ? pastCutoff
              ? " It's after 10pm, so today and tomorrow can't be booked — the earliest date is the day after tomorrow."
              : " Today can't be booked — the earliest date is tomorrow (bookings for tomorrow close at 10pm)."
            : ""}
          {multiple ? " Click as many dates as you'd like — each becomes its own booking." : ""}
        </p>
        {multiple && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {props.value.length} date{props.value.length === 1 ? "" : "s"} selected
            </span>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
