import { NextResponse } from "next/server"
import { auth } from "@/auth"
import type { WalkType } from "@/generated/prisma/client"
import { listAvailableDays } from "@/lib/availability"
import { parseMonthParam } from "@/lib/dates"
import { WALK_TYPES, DEFAULT_WALK_TYPE } from "@/lib/walk-types"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const serviceSlug = searchParams.get("serviceSlug")
  if (serviceSlug !== "daycare" && serviceSlug !== "meet-greet" && serviceSlug !== "dog-walking") {
    return NextResponse.json({ error: "Unknown service" }, { status: 400 })
  }

  const { year, monthIndex } = parseMonthParam(searchParams.get("month") ?? undefined)
  const rangeStart = new Date(year, monthIndex, 1)
  const rangeEnd = new Date(year, monthIndex + 1, 0)

  const walkTypeParam = searchParams.get("walkType") as WalkType | null
  const walkType = walkTypeParam && WALK_TYPES.includes(walkTypeParam) ? walkTypeParam : DEFAULT_WALK_TYPE

  const available = await listAvailableDays(serviceSlug, rangeStart, rangeEnd, walkType)
  return NextResponse.json({ available })
}
