"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toDateInputValue } from "@/lib/dates"

/**
 * Date-based booking step (daycare / meet & greet) picker. Circles every
 * weekday in the visible month that's actually available, fetched in one
 * batch per month rather than checking day by day — the highlight is just a
 * guide though, not the final word: "Check availability" still re-verifies
 * whatever day gets picked, since someone else could book it in between.
 */
export function AvailabilityDatePicker({
  serviceSlug,
  value,
  onChange,
}: {
  serviceSlug: "daycare" | "meet-greet"
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date>(() =>
    value ? new Date(`${value}T00:00:00`) : new Date()
  )
  const [availableDays, setAvailableDays] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    let cancelled = false
    const monthParam = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
    fetch(`/api/book/availability-month?serviceSlug=${serviceSlug}&month=${monthParam}`)
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
  }, [serviceSlug, month])

  const selectedDate = value ? new Date(`${value}T00:00:00`) : undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          <CalendarIcon className="mr-2 size-4 text-muted-foreground" />
          {selectedDate ? selectedDate.toLocaleDateString("en-GB") : "Select a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          month={month}
          onMonthChange={setMonth}
          disabled={[{ before: today }, { dayOfWeek: [0, 6] }]}
          modifiers={{ available: (date) => availableDays.has(toDateInputValue(date)) }}
          modifiersClassNames={{ available: "ring-2 ring-primary ring-inset rounded-full" }}
          onSelect={(date) => {
            if (date) {
              onChange(toDateInputValue(date))
              setOpen(false)
            }
          }}
        />
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Circled days have space available.
        </p>
      </PopoverContent>
    </Popover>
  )
}
