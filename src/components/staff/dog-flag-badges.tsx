import { AlertTriangle } from "lucide-react"
import { DOG_FLAG_LABELS } from "@/lib/dog-flags"
import type { DogFlagType } from "@/generated/prisma/client"

export function DogFlagBadges({ flags }: { flags: { type: DogFlagType; notes?: string | null }[] }) {
  if (flags.length === 0) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {flags.map((flag) => (
        <span
          key={flag.type}
          title={flag.notes ? `${DOG_FLAG_LABELS[flag.type]}: ${flag.notes}` : DOG_FLAG_LABELS[flag.type]}
          className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          {DOG_FLAG_LABELS[flag.type]}
        </span>
      ))}
    </span>
  )
}
