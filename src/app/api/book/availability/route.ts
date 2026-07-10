import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  findAvailableKennelUnit,
  isDaycareAvailable,
  listAvailableVanRuns,
  listAvailableWalkSlots,
} from "@/lib/availability"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const serviceSlug = searchParams.get("serviceSlug")

  if (serviceSlug === "overnight-boarding") {
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const dogCount = Number(searchParams.get("dogCount") ?? "1")
    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Missing dates" }, { status: 400 })
    }
    const unit = await findAvailableKennelUnit(new Date(startDate), new Date(endDate), dogCount)
    return NextResponse.json({ available: !!unit })
  }

  if (serviceSlug === "daycare") {
    const date = searchParams.get("date")
    if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 })
    const result = await isDaycareAvailable(new Date(date))
    return NextResponse.json(result)
  }

  if (serviceSlug === "secure-forest-walks") {
    const slots = await listAvailableWalkSlots(new Date())
    return NextResponse.json({
      slots: slots.map((slot) => ({
        id: slot.id,
        date: slot.date,
        time: slot.time,
        durationMin: slot.durationMin,
        remaining: slot.remaining,
      })),
    })
  }

  if (serviceSlug === "dog-walking") {
    const runs = await listAvailableVanRuns(new Date())
    return NextResponse.json({
      runs: runs.map((run) => ({
        id: run.id,
        date: run.date,
        name: run.name,
        startTime: run.startTime,
        remaining: run.remaining,
      })),
    })
  }

  return NextResponse.json({ error: "Unknown service" }, { status: 400 })
}
