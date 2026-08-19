import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { formatPence } from "@/lib/format"
import { SubscriptionForm } from "@/components/portal/subscription-form"
import { SubscriptionActions } from "@/components/portal/subscription-actions"
import { WEEKDAY_LABELS, parseWeekdays } from "@/lib/subscriptions"

export const metadata: Metadata = {
  title: "Recurring Bookings",
}

// Recurring Bookings is removed from the customer portal for now (nav entry
// pulled too — see portal-nav.tsx). Underlying code left in place so this
// is easy to re-enable later; direct URL access redirects to the dashboard.
const FEATURE_ENABLED = false

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting payment setup",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  PAST_DUE: "Payment failed",
}

export default async function PortalSubscriptionsPage() {
  if (!FEATURE_ENABLED) redirect("/portal")

  const session = await auth()
  const [dogs, subscriptions] = await Promise.all([
    prisma.dog.findMany({ where: { ownerId: session!.user.id }, orderBy: { name: "asc" } }),
    prisma.subscription.findMany({
      where: { customerId: session!.user.id },
      orderBy: { id: "desc" },
      include: { service: true, dog: true },
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recurring Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up recurring weekly daycare or dog walking — pause individual weeks or cancel anytime.
        </p>
      </div>

      {dogs.length > 0 ? (
        <SubscriptionForm dogs={dogs.map((d) => ({ id: d.id, name: d.name }))} />
      ) : (
        <p className="text-sm text-muted-foreground">Add a dog profile before setting up a subscription.</p>
      )}

      {subscriptions.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-medium">
                  {sub.service.name} — {sub.dog.name}
                </p>
                <p className="text-muted-foreground">
                  {parseWeekdays(sub.weekdays)
                    .sort()
                    .map((d) => WEEKDAY_LABELS[d])
                    .join(", ")}{" "}
                  at {sub.slot} — {formatPence(sub.service.basePricePence * parseWeekdays(sub.weekdays).length)}/week
                </p>
                {sub.status === "PAUSED" && sub.pausedUntil && (
                  <p className="text-muted-foreground">
                    Paused until {sub.pausedUntil.toLocaleDateString("en-GB")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={sub.status === "ACTIVE" ? "default" : "secondary"}>
                  {STATUS_LABELS[sub.status] ?? sub.status}
                </Badge>
                {(sub.status === "ACTIVE" || sub.status === "PAUSED" || sub.status === "PENDING") && (
                  <SubscriptionActions subscriptionId={sub.id} status={sub.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
