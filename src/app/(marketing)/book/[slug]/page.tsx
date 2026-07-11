import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"
import { hasCurrentSignedAgreement } from "@/lib/agreement"
import { BookingWizard } from "@/components/marketing/booking-wizard"

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
