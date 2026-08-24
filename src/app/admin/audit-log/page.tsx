import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildAuditLogWhere, AUDIT_LOG_CATEGORIES } from "@/lib/audit-log-filters"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { deleteAllAuditLogs } from "./actions"

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

type AuditLogSearchParams = {
  q?: string
  user?: string
  category?: string
  from?: string
  to?: string
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogSearchParams>
}) {
  const session = await auth()
  // Admins only — the /admin layout already enforces role === "ADMIN", so
  // this is just a defensive re-check rather than the primary gate.
  if (!session?.user || session.user.role !== "ADMIN") {
    notFound()
  }

  const { q = "", user = "", category = "", from = "", to = "" } = await searchParams
  const filters = { q, user, category, from, to }

  const logs = await prisma.auditLog.findMany({
    where: buildAuditLogWhere(filters),
    orderBy: { createdAt: "desc" },
    include: { actor: true },
    take: 200,
  })

  const exportParams = new URLSearchParams()
  if (q.trim()) exportParams.set("q", q.trim())
  if (user.trim()) exportParams.set("user", user.trim())
  if (category) exportParams.set("category", category)
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  const exportQuery = exportParams.toString()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change made in the system — who, what, and when. Visible to admins
          only. Showing the most recent {logs.length === 200 ? "200" : logs.length}
          {logs.length === 200 ? " (of possibly more) " : " "}
          entries matching the filters below.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="q">Search (action or detail)</Label>
          <Input id="q" name="q" defaultValue={q} className="w-64" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user">Staff name or customer ID</Label>
          <Input id="user" name="user" defaultValue={user} className="w-56" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            defaultValue={category}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All</option>
            {AUDIT_LOG_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={from} className="w-40" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={to} className="w-40" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {(q || user || category || from || to) && (
          <Button asChild variant="ghost">
            <a href="/admin/audit-log">Clear</a>
          </Button>
        )}
      </form>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/audit-log/export?format=csv${exportQuery ? `&${exportQuery}` : ""}`}>
            Export CSV
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/audit-log/export?format=json${exportQuery ? `&${exportQuery}` : ""}`}>
            Export JSON
          </a>
        </Button>
        {session.user.isSuperAdmin && (
          <ConfirmDeleteButton
            label="Delete all entries"
            title="Delete the entire audit log?"
            description="This permanently deletes every entry in the audit log, including everything shown by other filters. This cannot be undone — export a copy first if you need one."
            onConfirm={deleteAllAuditLogs}
          />
        )}
      </div>

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
                  <td className="max-w-md p-3 whitespace-pre-wrap text-muted-foreground">{log.meta ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {q || user || category || from || to
            ? "No matching entries."
            : "No changes have been logged yet."}
        </p>
      )}
    </div>
  )
}
