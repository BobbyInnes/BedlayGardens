import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { moderateReview } from "@/app/admin/reviews/actions"

export const metadata: Metadata = {
  title: "Reviews | Admin",
}

export default async function AdminReviewsPage() {
  const [pending, moderated] = await Promise.all([
    prisma.review.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { customer: true, booking: { include: { service: true } } },
    }),
    prisma.review.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { customer: true, booking: { include: { service: true } } },
    }),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Awaiting moderation ({pending.length})</h2>
        {pending.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {pending.map((review) => (
              <li key={review.id} className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {review.customer.name} — {review.booking.service.name}
                  </p>
                  <span className="text-muted-foreground">{"★".repeat(review.rating)}</span>
                </div>
                {review.text && <p className="text-muted-foreground">{review.text}</p>}
                <div className="flex gap-2">
                  <form action={moderateReview.bind(null, review.id, "APPROVED")}>
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={moderateReview.bind(null, review.id, "REJECTED")}>
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews awaiting moderation.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent decisions</h2>
        {moderated.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {moderated.map((review) => (
              <li key={review.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">
                    {review.customer.name} — {review.booking.service.name}
                  </p>
                  {review.text && <p className="text-muted-foreground">{review.text}</p>}
                </div>
                <Badge variant={review.status === "APPROVED" ? "default" : "secondary"}>
                  {review.status}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No decisions yet.</p>
        )}
      </section>
    </div>
  )
}
