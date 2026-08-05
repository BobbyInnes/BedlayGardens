import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildSentEmailWhere } from "@/lib/sent-email-filters"

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const MAX_EXPORT_ROWS = 5000

export async function GET(request: Request) {
  const session = await auth()
  // Matches the emails page: hide that this even exists from non-admins.
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)

  const emails = await prisma.sentEmail.findMany({
    where: buildSentEmailWhere({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
    orderBy: { sentAt: "desc" },
    take: MAX_EXPORT_ROWS,
  })

  const timestamp = new Date().toISOString().slice(0, 10)
  const header = ["Date & time", "To", "Subject", "Status", "Error"]
  const rows = emails.map((email) => [
    email.sentAt.toISOString(),
    email.to,
    email.subject,
    email.status,
    email.error ?? "",
  ])
  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sent-emails-${timestamp}.csv"`,
    },
  })
}
