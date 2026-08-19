import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buildSentEmailWhere, SENT_EMAIL_STATUSES } from "@/lib/sent-email-filters"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Sent Emails | Admin",
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

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "SENT") return "default"
  if (status === "FAILED") return "destructive"
  return "secondary"
}

type EmailsSearchParams = {
  q?: string
  status?: string
  from?: string
  to?: string
}

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<EmailsSearchParams>
}) {
  const session = await auth()
  // Admins only — the /admin layout already enforces role === "ADMIN", so
  // this is just a defensive re-check rather than the primary gate.
  if (!session?.user || session.user.role !== "ADMIN") {
    notFound()
  }

  const { q = "", status = "", from = "", to = "" } = await searchParams
  const filters = { q, status, from, to }

  const emails = await prisma.sentEmail.findMany({
    where: buildSentEmailWhere(filters),
    orderBy: { sentAt: "desc" },
    take: 200,
  })

  // Best-effort match of each recipient address to a customer/staff account,
  // so the table can link through to them — not every recipient has one
  // (the business inbox, a voucher sent to someone with no account here).
  const recipients = [...new Set(emails.map((e) => e.to))]
  const matchedUsers = await prisma.user.findMany({
    where: { email: { in: recipients } },
    select: { id: true, name: true, email: true, role: true },
  })
  const userByEmail = new Map(matchedUsers.map((u) => [u.email, u]))

  const exportParams = new URLSearchParams()
  if (q.trim()) exportParams.set("q", q.trim())
  if (status) exportParams.set("status", status)
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  const exportQuery = exportParams.toString()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sent Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every email the app has attempted to send — who, when, and the subject line.
          Showing the most recent {emails.length === 200 ? "200" : emails.length}
          {emails.length === 200 ? " (of possibly more) " : " "}
          matching the filters below. For full delivery/bounce/open status, check the
          Resend dashboard directly.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="q">Search (recipient or subject)</Label>
          <Input id="q" name="q" defaultValue={q} className="w-64" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All</option>
            {SENT_EMAIL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
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
        {(q || status || from || to) && (
          <Button asChild variant="ghost">
            <a href="/admin/emails">Clear</a>
          </Button>
        )}
      </form>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/emails/export?format=csv${exportQuery ? `&${exportQuery}` : ""}`}>
            Export CSV
          </a>
        </Button>
      </div>

      {emails.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-3 font-medium">Date &amp; time</th>
                <th className="p-3 font-medium">To</th>
                <th className="p-3 font-medium">Subject</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {emails.map((email) => {
                const user = userByEmail.get(email.to)
                return (
                  <tr key={email.id}>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(email.sentAt)}
                    </td>
                    <td className="p-3">
                      {user ? (
                        <>
                          <Link
                            href={
                              user.role === "CUSTOMER"
                                ? `/admin/customers/${user.id}`
                                : `/staff/team/${user.id}`
                            }
                            className="font-medium hover:underline"
                          >
                            {user.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{email.to}</p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">{email.to}</p>
                      )}
                    </td>
                    <td className="max-w-md p-3 whitespace-pre-wrap">{email.subject}</td>
                    <td className="p-3">
                      <Badge variant={statusVariant(email.status)}>{email.status}</Badge>
                      {email.error && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{email.error}</p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {q || status || from || to ? "No matching emails." : "No emails have been sent yet."}
        </p>
      )}
    </div>
  )
}
