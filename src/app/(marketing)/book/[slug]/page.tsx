import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { hasCurrentSignedAgreement } from "@/lib/agreement"
import { checkTrialGate } from "@/lib/trial"
import { BookingWizard } from "@/components/marketing/booking-wizard"
import { Button } from "@/components/ui/button"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const service = await prisma.service.findUnique({ where: { slug } })
  return { title: service ? `Book ${service.name}` : "Book" }
}

export default async function BookServicePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=/book/${slug}`)
  }

  const service = await prisma.service.findUnique({ where: { slug } })
  if (!service || !service.active) notFound()

  if (!(await hasCurrentSignedAgreement(session.user.id))) {
    redirect(`/portal/agreement?returnTo=/book/${slug}`)
  }

  const [dogs, addons, settings] = await Promise.all([
    prisma.dog.findMany({ where: { ownerId: session.user.id }, orderBy: { name: "asc" } }),
    prisma.addon.findMany({ where: { serviceId: service.id, active: true } }),
    getSettings(),
  ])

  if (dogs.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight sm:text-3xl">
          Book {service.name}
        </h1>
        <div className="flex items-start gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive sm:items-center">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
          <p className="text-sm font-bold sm:text-base">
            You need to add a dog profile to your account before you can book any service.
          </p>
        </div>
        <Button className="mt-6" asChild>
          <Link href="/portal/dogs/new">Add a dog</Link>
        </Button>
      </div>
    )
  }

  if (service.requiresTrial) {
    const missingTrial = await checkTrialGate(
      service.id,
      dogs.map((dog) => dog.id)
    )
    // Block outright only if none of the customer's dogs are eligible —
    // if at least one dog can book, let them into the wizard, where the
    // dog-selection step handles picking between eligible/ineligible dogs.
    if (missingTrial.length === dogs.length) {
      const meetGreetService = await prisma.service.findFirst({
        where: { AND: [{ name: { contains: "Meet", mode: "insensitive" } }, { name: { contains: "Greet", mode: "insensitive" } }] },
      })
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <h1 className="mb-8 text-2xl font-semibold tracking-tight sm:text-3xl">
            Book {service.name}
          </h1>
          <div className="flex items-start gap-3 rounded-xl border border-destructive bg-destructive/10 p-4 text-destructive sm:items-center">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 sm:mt-0" aria-hidden="true" />
            <p className="text-sm font-bold sm:text-base">
              {missingTrial.join(", ")} {missingTrial.length === 1 ? "hasn't" : "haven't"} had a
              Meet &amp; Greet evaluation yet. This is mandatory before {missingTrial.length === 1 ? "it" : "they"}{" "}
              can book any service.
            </p>
          </div>
          {meetGreetService && (
            <Button className="mt-6" asChild>
              <Link href={`/book/${meetGreetService.slug}`}>Book a Meet & Greet</Link>
            </Button>
          )}
        </div>
      )
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight sm:text-3xl">
        Book {service.name}
      </h1>
      <BookingWizard
        service={{
          id: service.id,
          slug: service.slug,
          name: service.name,
          pricingModel: service.pricingModel,
          basePricePence: service.basePricePence,
          halfDayPricePence: service.halfDayPricePence,
          paymentTiming: service.paymentTiming,
        }}
        dogs={dogs.map((dog) => ({ id: dog.id, name: dog.name, breed: dog.breed }))}
        addons={addons.map((addon) => ({
          id: addon.id,
          name: addon.name,
          description: addon.description,
          pricePence: addon.pricePence,
        }))}
        depositPercent={Number(settings.deposit_percent ?? "25")}
        secondDogDiscountPercent={Number(settings.second_dog_discount_percent ?? "0")}
      />
    </div>
  )
}
