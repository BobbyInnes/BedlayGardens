"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

// The "no dog profile yet" message only ever appears as a result of the
// customer actually trying to book — not on page load just because they
// have zero dogs (e.g. a brand new account shouldn't be greeted with an
// error before they've done anything). So this is a client component: the
// button always renders the same either way, but for a dogless customer it
// intercepts the click instead of navigating, and reveals the message +
// "Add a dog" button in place of going anywhere.
export function BookServiceCta({
  hasDogs,
  filters,
}: {
  hasDogs: boolean
  filters: React.ReactNode
}) {
  const [showNoDogsMessage, setShowNoDogsMessage] = React.useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">My Bookings</h1>
        {hasDogs ? (
          <Button size="sm" asChild>
            <Link href="/book">Book a service</Link>
          </Button>
        ) : (
          <Button size="sm" type="button" onClick={() => setShowNoDogsMessage(true)}>
            Book a service
          </Button>
        )}
        {filters}
      </div>

      {showNoDogsMessage && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">
            You need to add a dog profile to your account before you can book any service.
          </p>
          <Button size="sm" asChild>
            <Link href="/portal/dogs/new">Add a dog</Link>
          </Button>
        </div>
      )}
    </>
  )
}
