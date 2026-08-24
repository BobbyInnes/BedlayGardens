"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, AlertTriangle } from "lucide-react"

export type BookServiceTileData = {
  id: string
  slug: string
  name: string
  descriptionHtml: string
  priceLabel: string
  // Set only when this customer has no eligible dog for this service (every
  // dog on their account is missing a passed Meet & Greet) — clicking the
  // tile shows this instead of navigating to /book/[slug].
  blockedMessage: string | null
}

const tileClassName =
  "flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/50"

function TileContent({ service }: { service: BookServiceTileData }) {
  return (
    <>
      <div>
        <p className="font-semibold">{service.name}</p>
        <div
          className="mt-1 text-sm text-muted-foreground [&_img]:inline [&_img]:align-middle"
          dangerouslySetInnerHTML={{ __html: service.descriptionHtml }}
        />
        <p className="mt-2 text-sm font-medium text-primary">{service.priceLabel}</p>
      </div>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  )
}

export function BookServiceList({ services }: { services: BookServiceTileData[] }) {
  const [warning, setWarning] = React.useState<string | null>(null)

  return (
    <div className="space-y-4">
      {warning && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive sm:items-center"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
          <p className="text-sm font-bold sm:text-base">{warning}</p>
        </div>
      )}

      <div className="space-y-4">
        {services.map((service) =>
          service.blockedMessage ? (
            <button
              key={service.id}
              type="button"
              className={tileClassName}
              onClick={() => setWarning(service.blockedMessage)}
            >
              <TileContent service={service} />
            </button>
          ) : (
            <Link key={service.id} href={`/book/${service.slug}`} className={tileClassName}>
              <TileContent service={service} />
            </Link>
          )
        )}
      </div>
    </div>
  )
}
