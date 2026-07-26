import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Audit Log | Admin",
}

// "CREATE_FAQ" -> "Create Faq"
function humanizeAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()
  // Super-admin only — everyone else (including regular admins) gets a 404
  // rather than a page that reveals this exists but says "not allowed".
  if (!session?.user?.isSuperAdmin) {
    notFound()
  }

  const { q = "" } = await searchParams
  const query = q.trim()

  const logs = await prisma.auditLog.findMany({
    where: query
      ? {
          OR: [
            { action: { contains: query, mode: "insensitive" } },
            { entity: { contains: query, mode: "insensitive" } },
            { entityId: { contains: query, mode: "insensitive" } },
            { meta: { contains: query, mode: "insensitive" } },
            { actor: { name: { contains: query, mode: "insensitive" } } },
            { actor: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: { actor: true },
    take: 200,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change made in the admin area — who, what, and when. Visible to super admins
          only. Showing the most recent {logs.length === 200 ? "200" : logs.length}
          {logs.length === 200 ? " (of possibly more) " : " "}
          entries{query ? ` matching "${query}"` : ""}.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="q">Search (person, action, or detail)</Label>
          <Input id="q" name="q" defaultValue={q} className="w-72" />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {logs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-3 font-medium">Date &amp; time</th>
                <th className="p-3 font-medium">Who</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{log.actor?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{log.actor?.email}</p>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary" className="mb-1">
                      {humanizeAction(log.action)}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{log.entity}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{log.meta ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {query ? "No matching entries." : "No changes have been logged yet."}
        </p>
      )}
    </div>
  )
}
