import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { checkVaccinationGate } from "@/lib/vaccination-gate"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dogIds = searchParams.getAll("dogId")
  const throughDate = searchParams.get("throughDate")
  if (dogIds.length === 0 || !throughDate) {
    return NextResponse.json({ error: "Missing dogId or throughDate" }, { status: 400 })
  }

  const dogs = await prisma.dog.findMany({ where: { id: { in: dogIds } } })
  if (dogs.some((dog) => dog.ownerId !== session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await checkVaccinationGate(dogIds, new Date(throughDate))
  return NextResponse.json(result)
}
