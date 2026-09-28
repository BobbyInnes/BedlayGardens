import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { ReferralSourceManager } from "@/components/admin/referral-source-manager"

export const metadata: Metadata = {
  title: "Referral Sources | Admin",
}

export default async function AdminReferralSourcesPage() {
  const sources = await prisma.referralSource.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { customers: true } } },
  })

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Referral Sources</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The options in the &ldquo;How did you hear about us?&rdquo; dropdown on the create-account form. The
          order here is the order customers see. Deactivate an option to stop offering it — customers who already
          chose it keep their answer.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-100 p-4">
        <h2 className="text-sm font-semibold">Dropdown options</h2>
        <ReferralSourceManager
          sources={sources.map((s) => ({
            id: s.id,
            name: s.name,
            active: s.active,
            usageCount: s._count.customers,
          }))}
        />
      </section>
    </div>
  )
}
