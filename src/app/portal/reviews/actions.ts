"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type ReviewActionState = { status: "idle" | "error"; message?: string }

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(2000).optional().or(z.literal("")),
})

export async function submitReview(
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  const parsed = reviewSchema.safeParse({
    bookingId: formData.get("bookingId"),
    rating: formData.get("rating"),
    text: formData.get("text"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    include: { review: true },
  })
  if (!booking || booking.customerId !== session.user.id) {
    return { status: "error", message: "Booking not found." }
  }
  if (booking.status !== "CHECKED_OUT") {
    return { status: "error", message: "You can only review a completed stay." }
  }
  if (booking.review) {
    return { status: "error", message: "You've already reviewed this stay." }
  }

  await prisma.review.create({
    data: {
      customerId: session.user.id,
      bookingId: booking.id,
      rating: parsed.data.rating,
      text: parsed.data.text || null,
    },
  })

  revalidatePath("/portal/reviews")
  return { status: "idle", message: "Thanks for your review!" }
}
