import Image from "next/image"
import Link from "next/link"
import { Quote } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ServiceCard } from "@/components/marketing/service-card"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"

export const revalidate = 60

export default async function HomePage() {
  const [settings, services, testimonials, hero] = await Promise.all([
    getSettings(),
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.testimonial.findMany({ where: { visible: true }, take: 6 }),
    prisma.mediaItem.findFirst({ where: { usage: "HERO" } }),
  ])

  const businessName = settings.business_name ?? "Bedlay Gardens Kennels"
  const tagline = settings.business_tagline ?? "Secure countryside boarding near Glasgow"

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {hero && (
            <Image
              src={hero.url}
              alt={hero.altText ?? businessName}
              fill
              priority
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        </div>

        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6 sm:py-32">
          <p className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Family-run · Countryside setting
          </p>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {tagline}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Overnight boarding, daycare, secure forest walks, and door-to-door dog
            walking — all in one trusted countryside setting, with real-time
            availability and simple online booking.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/book">Book a stay</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/services">View services</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Our services
            </h2>
            <p className="mt-1 text-muted-foreground">
              Priced per stay, day, or session — always shown up front.
            </p>
          </div>
          <Link href="/services" className="text-sm font-medium text-primary hover:underline">
            See full pricing →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              name={service.name}
              slug={service.slug}
              description={service.description}
              basePricePence={service.basePricePence}
              pricingModel={service.pricingModel}
            />
          ))}
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="bg-secondary/40 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              What our guests&rsquo; owners say
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure
                  key={testimonial.id}
                  className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-6"
                >
                  <Quote className="size-6 text-primary" aria-hidden="true" />
                  <blockquote className="flex-1 text-sm text-card-foreground">
                    “{testimonial.text}”
                  </blockquote>
                  <figcaption className="text-sm font-medium text-muted-foreground">
                    — {testimonial.author}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ready to book your dog&rsquo;s stay?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Check live availability and pay a small deposit online in minutes.
        </p>
        <Button size="lg" className="mt-6" asChild>
          <Link href="/book">Book a stay</Link>
        </Button>
      </section>
    </div>
  )
}
