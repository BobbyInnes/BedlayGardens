import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { formatPence, formatPriceWithSuffix } from "@/lib/format"

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Overnight boarding, daycare, secure forest walks, and dog walking pricing at Bedlay Gardens Kennels.",
}

export const revalidate = 60

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { addons: { where: { active: true } } },
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Services & Pricing
        </h1>
        <p className="mt-3 text-muted-foreground">
          All prices in GBP. Live availability and exact totals are shown during booking.
        </p>
      </div>

      <div className="space-y-12">
        {services.map((service) => (
          <section
            key={service.id}
            id={service.slug}
            className="scroll-mt-24 rounded-xl border border-border bg-card p-6 sm:p-8"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold sm:text-2xl">{service.name}</h2>
              <p className="text-2xl font-semibold text-primary">
                {formatPriceWithSuffix(service.basePricePence, service.pricingModel)}
              </p>
            </div>
            <p className="mt-3 text-muted-foreground">{service.description}</p>

            {service.addons.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-foreground">Add-ons</h3>
                <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {service.addons.map((addon) => (
                    <li
                      key={addon.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-foreground">{addon.name}</p>
                        {addon.description && (
                          <p className="text-muted-foreground">{addon.description}</p>
                        )}
                      </div>
                      <p className="shrink-0 font-medium text-foreground">
                        {formatPence(addon.pricePence)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button className="mt-6" asChild>
              <Link href="/book">Book {service.name}</Link>
            </Button>
          </section>
        ))}
      </div>
    </div>
  )
}
