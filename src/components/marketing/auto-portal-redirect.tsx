"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

const REDIRECT_DELAY_MS = 5000

/** Auto-redirects to the portal once there's nothing left for the customer to
 * do on this confirmation page (no pending payment) — only mounted by the
 * parent when that's true, so a booking still needing a Pay button never
 * gets swept away before the customer can act on it. */
export function AutoPortalRedirect({ to = "/portal/bookings" }: { to?: string }) {
  const router = useRouter()
  const [secondsLeft, setSecondsLeft] = React.useState(Math.ceil(REDIRECT_DELAY_MS / 1000))

  React.useEffect(() => {
    const redirectTimer = setTimeout(() => router.push(to), REDIRECT_DELAY_MS)
    const tickTimer = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => {
      clearTimeout(redirectTimer)
      clearInterval(tickTimer)
    }
  }, [router, to])

  return (
    <p className="mt-3 text-center text-sm text-muted-foreground">
      Taking you back to your account in {secondsLeft}s…
    </p>
  )
}
