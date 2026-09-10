import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { checkTrialGate, serviceRequiresTrial } from "@/lib/trial"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dogIds = searchParams.getAll("dogId")
  const serviceSlug = searchParams.get("serviceSlug")
  if (dogIds.length === 0 || !serviceSlug) {
    return NextResponse.json({ error: "Missing dogId or serviceSlug" }, { status: 400 })
  }

  const dogs = await prisma.dog.findMany({ where: { id: { in: dogIds } } })
  if (dogs.some((dog) => dog.ownerId !== session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const service = await prisma.service.findUnique({ where: { slug: serviceSlug } })
  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 })
  }

  // Dog Walking doesn't require a passed trial to book (unlike most other
  // services — see requiresTrial), but the customer should still be told if
  // a selected dog hasn't had one, as a non-blocking heads-up rather than
  // the hard "can't book" gate below. `requiresTrial` in the response tells
  // the wizard which of the two this is. serviceRequiresTrial (not the raw
  // field) also keeps meet-greet itself exempt regardless of that setting —
  // see its doc comment.
  if (!serviceRequiresTrial(service) && service.slug !== "dog-walking") {
    return NextResponse.json({ missing: [], requiresTrial: false })
  }

  const missing = await checkTrialGate(service.id, dogIds)
  return NextResponse.json({ missing, requiresTrial: serviceRequiresTrial(service) })
}
