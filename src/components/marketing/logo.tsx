import { Dog } from "lucide-react"

import { cn } from "@/lib/utils"

// Placeholder for the real Bedlay Gardens logo (line-drawn pack of dogs beside
// the wordmark) until the asset is supplied — see DESIGN-bedlay-gardens.md §1.
export function Logo({
  businessName,
  className,
  wordmarkClassName,
}: {
  businessName: string
  className?: string
  wordmarkClassName?: string
}) {
  const wordmark = businessName.replace(/\s+kennels$/i, "")

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex items-end" aria-hidden="true">
        <Dog className="size-4 -mr-1 opacity-60" strokeWidth={1.5} />
        <Dog className="size-5 -mr-1 opacity-80" strokeWidth={1.5} />
        <Dog className="size-6" strokeWidth={1.5} />
      </span>
      <span
        className={cn(
          "font-heading text-sm font-bold uppercase leading-none tracking-[0.16em] sm:text-base",
          wordmarkClassName
        )}
      >
        {wordmark}
      </span>
    </span>
  )
}
