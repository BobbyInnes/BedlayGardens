import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { findDogBookingConflicts, formatDogBookingConflicts } from "@/lib/booking-conflicts"

// Client-side early warning for the same "a dog can only be booked into one
// service at a time" rule resolveBookingCreation enforces server-side
// (book/actions.ts's checkForDuplicateServiceBooking, called just before
// each booking is actually created). Without this, the wizard only ever
// surfaced the conflict when the final "Confirm booking" submission failed
// on the review step — this lets it show as soon as dates + dogs are both
// known (the "Dogs" step's Continue button), mirroring how trial-check and
// vaccination-check already work early. resolveBookingCreation remains the
// real gate; this is a UX convenience, not a replacement for it.
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dogIds = searchParams.getAll("dogId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  if (dogIds.length === 0 || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing dogId, startDate, or endDate" }, { status: 400 })
  }

  const dogs = await prisma.dog.findMany({ where: { id: { in: dogIds } } })
  if (dogs.some((dog) => dog.ownerId !== session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const conflicts = await findDogBookingConflicts(dogIds, new Date(startDate), new Date(endDate))
  return NextResponse.json({ conflicts: formatDogBookingConflicts(conflicts) })
}
