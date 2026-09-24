import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { TagListManager } from "@/components/admin/tag-list-manager"

export const metadata: Metadata = {
  title: "Tags | Admin",
}

export default async function AdminTagsPage() {
  const [customerTags, dogTags] = await Promise.all([
    prisma.customerTag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assignments: true } } },
    }),
    prisma.dogTag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assignments: true } } },
    }),
  ])

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal labels for customers and dogs. Tags are only ever shown in the admin area — customers never see them.
          Pick them from the dropdown on a customer&rsquo;s or dog&rsquo;s details.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
        <h2 className="text-sm font-semibold">Customer tags</h2>
        <TagListManager
          kind="customer"
          itemNoun="customer"
          tags={customerTags.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            active: t.active,
            usageCount: t._count.assignments,
          }))}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
        <h2 className="text-sm font-semibold">Dog tags</h2>
        <TagListManager
          kind="dog"
          itemNoun="dog"
          tags={dogTags.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            active: t.active,
            usageCount: t._count.assignments,
          }))}
        />
      </section>
    </div>
  )
}
