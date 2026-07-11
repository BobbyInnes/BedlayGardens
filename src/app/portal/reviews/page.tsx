import type { Metadata } from "next"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ReviewForm } from "@/components/portal/review-form"

export const metadata: Metadata = {
  title: "Reviews",
}

export default async function PortalReviewsPage() {
  const session = await auth()

  const [needingReview, submitted] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: session!.user.id, status: "CHECKED_OUT", review: null },
      include: { service: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.review.findMany({
      where: { customerId: session!.user.id },
      include: { booking: { include: { service: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rate and review your dog&rsquo;s past stays — approved reviews appear on our site.
        </p>
      </div>

      {needingReview.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Leave a review</h2>
          {needingReview.map((booking) => (
            <ReviewForm key={booking.id} bookingId={booking.id} serviceName={booking.service.name} />
          ))}
        </section>
      )}

      {submitted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your reviews</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {submitted.map((review) => (
              <li key={review.id} className="space-y-1 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{review.booking.service.name}</p>
                  <span className="text-muted-foreground">{"★".repeat(review.rating)}</span>
                </div>
                {review.text && <p className="text-muted-foreground">{review.text}</p>}
                <p className="text-xs text-muted-foreground capitalize">{review.status.toLowerCase()}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {needingReview.length === 0 && submitted.length === 0 && (
        <p className="text-sm text-muted-foreground">No stays ready for review yet.</p>
      )}
    </div>
  )
}
