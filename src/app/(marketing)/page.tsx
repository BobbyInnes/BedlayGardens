import Image from "next/image"
import Link from "next/link"
import {
  BadgeCheck,
  CalendarCheck,
  Check,
  LayoutDashboard,
  Lock,
  MailCheck,
  Megaphone,
  Quote,
  ShieldCheck,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { HeroVideo } from "@/components/marketing/hero-video"
import { ServiceCard } from "@/components/marketing/service-card"
import { prisma } from "@/lib/prisma"
import { sanitizeRichText } from "@/lib/sanitize-html"
import { getSettings } from "@/lib/settings"

export const revalidate = 60

const stats = [
  { value: "10+", label: "Years in operation" },
  { value: "1000+", label: "Dogs cared for" },
  { value: "Licensed", label: "Council approved" },
  { value: "24/7", label: "On-site supervision" },
]

const features = [
  {
    icon: ShieldCheck,
    text: "Vaccination record verification before every stay",
  },
  {
    icon: UtensilsCrossed,
    text: "Individual feeding plans and dietary requirements",
  },
  {
    icon: Lock,
    text: "Secure online booking and payment",
  },
  {
    icon: MailCheck,
    text: "Automated booking confirmations by email",
  },
  {
    icon: LayoutDashboard,
    text: "Owner portal to manage all bookings",
  },
  {
    icon: UsersRound,
    text: "Admin dashboard for staff management",
  },
]

const steps = [
  {
    number: "01",
    title: "Register Online",
    text: "Create your account, add your dog's details, and upload vaccination records in minutes.",
  },
  {
    number: "02",
    title: "Make a Booking",
    text: "Choose a service and your dates, check live availability, and pay securely online.",
  },
  {
    number: "03",
    title: "Drop Off & Relax",
    text: "Bring your dog to us and enjoy your time away — we'll handle everything else and keep you updated.",
  },
]

const portalPoints = [
  "Book, amend, and cancel stays from your owner portal",
  "Track vaccination status and get expiry reminders",
  "Automatic confirmations, receipts, and check-in reminders",
  "Staff manage arrivals, care tasks, and payments in one dashboard",
]

const mockArrivals = [
  { dog: "Bella", service: "Home Boarding", status: "Confirmed" },
  { dog: "Max", service: "Day Care", status: "Confirmed" },
  { dog: "Luna", service: "Forest Walk", status: "Pending vacc." },
]

export default async function HomePage() {
  const [settings, services, testimonials, hero, approvedReviews, serviceMedia] = await Promise.all([
    getSettings(),
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.testimonial.findMany({ where: { visible: true }, take: 6 }),
    prisma.mediaItem.findFirst({
      where: { usage: "HERO" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.review.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    }),
    prisma.mediaItem.findMany({
      where: { usage: "SERVICE", type: "IMAGE" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ])

  // Service-card photos are matched by the media item's category — admins set
  // it to the service slug (preferred) or the service name. First item per
  // category wins (they're sorted by sortOrder above).
  const serviceImageByKey = new Map<string, { url: string; altText: string | null }>()
  for (const item of serviceMedia) {
    const key = item.category?.trim().toLowerCase()
    if (key && !serviceImageByKey.has(key)) {
      serviceImageByKey.set(key, { url: item.url, altText: item.altText })
    }
  }

  const businessName = settings.business_name ?? "Bedlay Gardens Kennels"

  return (
    <div>
      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-navy">
        <div className="absolute inset-0">
          {hero && hero.type === "VIDEO" ? (
            <HeroVideo src={hero.url} poster={hero.thumbnailUrl} />
          ) : (
            hero && (
              <Image
                src={hero.url}
                alt={hero.altText ?? businessName}
                fill
                priority
                // object-contain (not cover) so the whole photo stays visible
                // instead of being cropped to fill the banner shape; scaled up
                // 30% to close most of the letterboxed gap on the sides — the
                // section has overflow-hidden, so any excess top/bottom is
                // trimmed cleanly rather than distorting the image.
                className="object-contain scale-[1.3]"
              />
            )
          )}
          {/* Faint scrim, just enough for the text below to stay readable —
              the photo itself should read as bright, not tinted dark. */}
          <div className="absolute inset-0 bg-gradient-to-r from-navy/35 via-navy/10 to-transparent" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6 sm:py-32">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgb(0_0_0_/_45%)]">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Licensed &amp; Council Approved
          </p>
          <h1 className="max-w-2xl font-heading text-4xl font-extrabold tracking-tight text-white [text-shadow:0_2px_10px_rgb(0_0_0_/_55%)] sm:text-5xl lg:text-6xl">
            Professional Dog Boarding You Can Trust
          </h1>
          <p className="max-w-xl text-lg text-white/90 [text-shadow:0_1px_6px_rgb(0_0_0_/_50%)]">
            Safe, caring, and fully managed stays for your dog — with online
            booking, vaccination tracking, and real-time updates.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/book">Book a Stay</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="/login">Dog Owner Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Announcement banner — editable in Admin → Content, hidden when empty */}
      {settings.announcement_banner?.trim() && (
        <section className="border-b border-amber-200/70 bg-amber-50">
          <div className="mx-auto flex max-w-6xl items-start gap-4 px-4 py-6 sm:px-6">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Megaphone className="size-5" aria-hidden="true" />
            </span>
            <div
              className="space-y-2 text-sm leading-relaxed text-foreground [&>p:first-child]:text-base [&>p:first-child]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(settings.announcement_banner) }}
            />
          </div>
        </section>
      )}

      {/* 2. Stats band */}
      <section className="bg-navy text-navy-foreground">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-8 border-t border-white/10 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-white/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. What We Offer */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            What We Offer
          </h2>
          <p className="mt-3 text-lg text-primary">
            Everything your dog needs, managed in one place.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const image =
              serviceImageByKey.get(service.slug) ??
              serviceImageByKey.get(service.name.toLowerCase())
            return (
              <ServiceCard
                key={service.id}
                name={service.name}
                slug={service.slug}
                description={service.description}
                basePricePence={service.basePricePence}
                pricingModel={service.pricingModel}
                imageUrl={image?.url}
                imageAlt={image?.altText}
              />
            )
          })}
        </div>
      </section>

      {/* 4. Feature checklist strip */}
      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-6 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.text} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="size-4.5" aria-hidden="true" />
              </span>
              <p className="pt-1.5 text-sm font-medium text-foreground">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. How It Works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-3 text-lg text-primary">
            From first visit to drop-off in three simple steps.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number}>
              <p className="font-heading text-5xl font-extrabold tracking-tight text-primary/20">
                {step.number}
              </p>
              <h3 className="mt-3 font-heading text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Online management system showcase */}
      <section className="bg-secondary/60">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
              A Complete Online Management System
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every stay is managed through our secure online platform — owners
              book and track everything from their own portal, while our staff
              run daily care from a dedicated dashboard.
            </p>
            <ul className="mt-6 space-y-3">
              {portalPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm font-medium">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <Button className="mt-8" asChild>
              <Link href="/register">Create Your Account</Link>
            </Button>
          </div>

          {/* Stylised mock of the staff dashboard (illustrative only) */}
          <div aria-hidden="true" className="rounded-2xl bg-card p-6 shadow-xl shadow-navy/10 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between">
              <p className="font-heading text-sm font-semibold">Today&rsquo;s overview</p>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Admin dashboard
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { value: "12", label: "Dogs in" },
                { value: "5", label: "Bookings today" },
                { value: "2", label: "Pending vaccinations" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-secondary p-3 text-center">
                  <p className="font-heading text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Arrivals
            </p>
            <ul className="mt-2 divide-y divide-border">
              {mockArrivals.map((arrival) => (
                <li key={arrival.dog} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 font-heading text-xs font-bold text-primary">
                      {arrival.dog[0]}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{arrival.dog}</p>
                      <p className="text-xs text-muted-foreground">{arrival.service}</p>
                    </div>
                  </div>
                  <span
                    className={
                      arrival.status === "Confirmed"
                        ? "rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
                    }
                  >
                    {arrival.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="mb-10 text-center font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            What Owners Say
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <figure
                key={testimonial.id}
                className="flex h-full flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
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
        </section>
      )}

      {approvedReviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 className="mb-10 text-center font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Recent Reviews
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {approvedReviews.slice(0, 6).map((review) => (
              <figure
                key={review.id}
                className="flex h-full flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
              >
                <span className="text-primary" aria-hidden="true">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                {review.text && (
                  <blockquote className="flex-1 text-sm text-card-foreground">
                    “{review.text}”
                  </blockquote>
                )}
                <figcaption className="text-sm font-medium text-muted-foreground">
                  — {review.customer.name.split(" ")[0]}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 7. CTA band */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to Book Your Dog&rsquo;s Next Stay?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Create an account, add your dog, and book your first stay in minutes.
          </p>
          <Button
            size="lg"
            className="mt-7 bg-white text-primary hover:bg-white/90"
            asChild
          >
            <Link href="/register">
              <CalendarCheck className="size-4.5" aria-hidden="true" />
              Create an Account
            </Link>
          </Button>
          <p className="mt-4 text-sm text-primary-foreground/80">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-white underline underline-offset-4">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
