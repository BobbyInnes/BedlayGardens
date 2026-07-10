import Link from "next/link"
import { CalendarCheck } from "lucide-react"

export function FloatingBookCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <Link
        href="/book"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm"
      >
        <CalendarCheck className="size-4" aria-hidden="true" />
        Book now
      </Link>
    </div>
  )
}
