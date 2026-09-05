import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { formatPence } from "@/lib/format"
import { addDays } from "@/lib/dates"
import { today } from "@/lib/staff-dates"
import { upcomingBookingReminderEmail } from "@/lib/email-templates"

export const metadata: Metadata = {
  title: "Reminder Email Preview | Admin",
}

// Read-only preview of the exact HTML sendUpcomingBookingReminders (see
// api/cron/send-reminders) would send for this service — nothing here is
// actually sent. Shows both variants (nothing outstanding / balance owing)
// for each reminder slot the service has configured, since the wording
// differs between them.
export default async function ReminderPreviewPage({
  params,
}: {
  params: Promise<{ serviceId: string }>
}) {
  const { serviceId } = await params
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) notFound()

  const settings = await getSettings()
  // Illustrative only — half the base price, just to show what the
  // "balance owing" wording and amount actually look like.
  const sampleOutstandingPence = Math.round(service.basePricePence / 2)

  const slots: { label: string; days: number | null }[] = [
    { label: "1st reminder", days: service.reminderDaysBefore },
    { label: "2nd reminder", days: service.secondReminderDaysBefore },
  ].filter((s) => s.days != null)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reminder email preview — {service.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is exactly what the cron job sends — nothing on this page is a real email. Set the
          reminder day fields on the service to change what&rsquo;s shown here.
        </p>
        <Link href={`/admin/services/${service.id}`} className="mt-2 inline-block text-sm underline">
          ← Back to {service.name}
        </Link>
      </div>

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reminder is configured for this service yet — set &ldquo;Reminder — days before
          booking&rdquo; on the service&rsquo;s edit page to enable one.
        </p>
      ) : (
        slots.map(({ label, days }) => {
          const startDate = addDays(today(), days!)
          const variants = [
            { title: `${label} (${days} days before) — nothing outstanding`, outstandingPence: 0 },
            {
              title: `${label} (${days} days before) — balance owing`,
              outstandingPence: sampleOutstandingPence,
            },
          ]
          return (
            <section key={label} className="space-y-4">
              <h2 className="text-lg font-semibold">{label}</h2>
              {variants.map((variant) => {
                const email = upcomingBookingReminderEmail(
                  settings,
                  { serviceName: service.name, startDate, endDate: startDate, dogNames: ["Bingo"] },
                  variant.outstandingPence,
                  "https://example.com/book/confirmation/sample000booking"
                )
                return (
                  <div key={variant.title} className="space-y-2">
                    <p className="text-sm font-medium">
                      {variant.title}
                      {variant.outstandingPence > 0 && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          (sample amount: {formatPence(variant.outstandingPence)})
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Subject: <span className="text-foreground">{email.subject}</span>
                    </p>
                    <div className="rounded-lg border border-border bg-white p-6">
                      <div dangerouslySetInnerHTML={{ __html: email.html }} />
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })
      )}
    </div>
  )
}
