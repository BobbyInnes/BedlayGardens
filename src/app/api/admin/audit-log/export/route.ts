import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildAuditLogWhere } from "@/lib/audit-log-filters"

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const MAX_EXPORT_ROWS = 5000

export async function GET(request: Request) {
  const session = await auth()
  // Matches the audit-log page: hide that this even exists from non-admins.
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") === "json" ? "json" : "csv"

  const logs = await prisma.auditLog.findMany({
    where: buildAuditLogWhere({
      q: searchParams.get("q") ?? undefined,
      user: searchParams.get("user") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
    orderBy: { createdAt: "desc" },
    include: { actor: true },
    take: MAX_EXPORT_ROWS,
  })

  const timestamp = new Date().toISOString().slice(0, 10)

  if (format === "json") {
    const data = logs.map((log) => ({
      id: log.id,
      dateTime: log.createdAt.toISOString(),
      actorName: log.actor?.name ?? null,
      actorEmail: log.actor?.email ?? null,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      detail: log.meta,
    }))

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${timestamp}.json"`,
      },
    })
  }

  const header = ["Date & time", "Actor name", "Actor email", "Action", "Entity", "Entity ID", "Detail"]
  const rows = logs.map((log) => [
    log.createdAt.toISOString(),
    log.actor?.name ?? "",
    log.actor?.email ?? "",
    log.action,
    log.entity,
    log.entityId,
    log.meta ?? "",
  ])
  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${timestamp}.csv"`,
    },
  })
}
