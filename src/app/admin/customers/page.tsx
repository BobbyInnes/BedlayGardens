import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Customers | Admin",
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = "" } = await searchParams

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(q.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: "insensitive" } },
              { email: { contains: q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { dogs: true, bookings: true } } },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="q">Name or email</Label>
          <Input id="q" name="q" defaultValue={q} className="w-64" />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {customers.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {customers.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/admin/customers/${customer.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-muted-foreground">{customer.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    {customer._count.dogs} dog{customer._count.dogs === 1 ? "" : "s"} ·{" "}
                    {customer._count.bookings} booking{customer._count.bookings === 1 ? "" : "s"}
                  </span>
                  <Badge variant={customer.active ? "secondary" : "destructive"}>
                    {customer.active ? "Active" : "Banned"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No customers match that search.</p>
      )}
    </div>
  )
}
