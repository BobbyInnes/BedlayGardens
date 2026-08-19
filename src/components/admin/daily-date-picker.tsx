"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { addDays, parseDateParam, toDateInputValue } from "@/lib/dates"

/**
 * Date navigation for the Daily Overview: prev/next day arrows either side
 * of a button that opens a real calendar for jumping to an arbitrary date,
 * replacing the old separate `<input type="date">` + "Go" form.
 */
export function DailyDatePicker({
  date,
  todayDate,
  assignee,
}: {
  /** Currently selected day, yyyy-mm-dd. */
  date: string
  /** Today's date server-side, yyyy-mm-dd — avoids relying on the client clock. */
  todayDate: string
  assignee: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const selected = parseDateParam(date)
  const isToday = date === todayDate

  function go(target: Date) {
    const params = new URLSearchParams({ date: toDateInputValue(target) })
    if (assignee !== "ALL") params.set("assignee", assignee)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => go(addDays(selected, -1))}
        className="rounded-md p-1 hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-foreground hover:bg-muted"
          >
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
            {selected.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              if (!day) return
              go(day)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      <button
        type="button"
        aria-label="Next day"
        onClick={() => go(addDays(selected, 1))}
        className="rounded-md p-1 hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="size-4" />
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => go(parseDateParam(todayDate))}
          className="ml-1 font-medium text-primary hover:underline"
        >
          Today
        </button>
      )}
    </div>
  )
}
