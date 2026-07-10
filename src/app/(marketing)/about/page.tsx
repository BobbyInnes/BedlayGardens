import type { Metadata } from "next"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { getSettings } from "@/lib/settings"

export const metadata: Metadata = {
  title: "About Us",
  description:
    "The story, team, and facilities behind Bedlay Gardens Kennels' countryside dog boarding.",
}

export const revalidate = 60

export default async function AboutPage() {
  const [settings, aboutMedia] = await Promise.all([
    getSettings(),
    prisma.mediaItem.findMany({ where: { usage: "ABOUT" }, orderBy: { sortOrder: "asc" } }),
  ])

  const teamImage = aboutMedia.find((item) => item.caption?.toLowerCase().includes("team"))
  const facilityImage = aboutMedia.find((item) => item.caption?.toLowerCase().includes("facility"))

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Us</h1>
        <p className="mt-3 text-muted-foreground">
          {settings.business_tagline ?? "Secure countryside boarding near Glasgow"}
        </p>
      </div>

      <section className="grid items-center gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Our story</h2>
          <p className="text-muted-foreground">
            {settings.business_name ?? "Bedlay Gardens Kennels"} started as a small,
            family-run kennels set in the countryside near Glasgow, built on the belief
            that every dog deserves space to roam, a real walk every day, and staff who
            know them by name. What began with a handful of kennels has grown into a
            full boarding, daycare, and dog walking service — without losing the
            personal touch our regulars have come to rely on.
          </p>
          <p className="text-muted-foreground">
            We&rsquo;re proud that most of our bookings come from returning guests and
            word of mouth. Every dog that stays with us gets an individual care plan
            covering feeding, medication, and behaviour, followed closely by our
            team from check-in to check-out.
          </p>
        </div>
        {teamImage && (
          <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-border">
            <Image
              src={teamImage.url}
              alt={teamImage.altText ?? "Our team"}
              fill
              className="object-cover"
            />
          </div>
        )}
      </section>

      <section className="mt-16 grid items-center gap-8 sm:grid-cols-2">
        {facilityImage && (
          <div className="relative order-2 aspect-4/3 overflow-hidden rounded-xl border border-border sm:order-1">
            <Image
              src={facilityImage.url}
              alt={facilityImage.altText ?? "Our facility"}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="order-1 space-y-4 sm:order-2">
          <h2 className="text-xl font-semibold">Our facility</h2>
          <p className="text-muted-foreground">
            Our site sits within enclosed private woodland, giving us the space for
            secure, escorted forest walks away from roads and livestock. Kennels are
            sized small, medium, and large, with sharing available for dogs from the
            same household, heated in winter and well-ventilated in summer.
          </p>
          <p className="text-muted-foreground">
            A dedicated van and driver handle our dog walking collection and
            drop-off service, and our daycare area gives day visitors room to play
            and rest between activities.
          </p>
        </div>
      </section>

      <section className="mt-16 space-y-4 text-center">
        <h2 className="text-xl font-semibold">Our team</h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Every member of staff is trained in canine first aid and handling, and gets
          to know each guest&rsquo;s routine, medication, and quirks before their first
          stay. It&rsquo;s a small team by design — so your dog is always looked after by
          someone who knows them.
        </p>
      </section>
    </div>
  )
}
