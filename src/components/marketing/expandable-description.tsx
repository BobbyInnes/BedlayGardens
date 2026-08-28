"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Service card descriptions are clamped to 4 lines so cards in the grid stay
// a consistent height, but some services (e.g. Meet & Greet & Evaluation)
// have much longer descriptions than others. This renders the clamp with a
// "Read more" toggle so the rest is one click away instead of just cut off.
// The toggle only appears when the text actually overflows 4 lines — short
// descriptions like "Overnight stay" never show a no-op button.
export function ExpandableDescription({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [html])

  return (
    <div className="flex-1">
      <div
        ref={ref}
        className={cn(
          "text-sm text-muted-foreground [&_img]:inline [&_img]:align-middle",
          !expanded && "line-clamp-4"
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="-ml-0.5 inline-block py-2 pl-0.5 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  )
}
