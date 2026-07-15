import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

async function main() {
  // Set ADMIN_SEED_PASSWORD in .env before seeding a real/production database —
  // never commit a real password here. Falls back to a known dev-only default
  // when unset, for local convenience.
  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD || "ChangeMe123!", 10)
  await prisma.user.upsert({
    where: { email: "admin@bedlaygardens.co.uk" },
    update: {},
    create: {
      email: "admin@bedlaygardens.co.uk",
      name: "Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  })

  const kennelUnits = [
    { name: "Kennel 1", size: "small", dogCapacity: 1 },
    { name: "Kennel 2", size: "small", dogCapacity: 1 },
    { name: "Kennel 3", size: "medium", dogCapacity: 2 },
    { name: "Kennel 4", size: "medium", dogCapacity: 2 },
    { name: "Kennel 5", size: "large", dogCapacity: 2 },
  ]
  for (const unit of kennelUnits) {
    await prisma.kennelUnit.upsert({
      where: { name: unit.name },
      update: {},
      create: unit,
    })
  }

  // Launch prices and copy from DESIGN-bedlay-gardens.md §4 — admin-editable
  // afterwards (seed never overwrites existing rows beyond requiresTrial).
  const services = [
    {
      slug: "meet-greet",
      name: "Meet & Greet",
      description:
        "The first step before booking — a chance for us to meet your dog and make sure the fit is right before their first stay.",
      pricingModel: "PER_SESSION" as const,
      basePricePence: 1500,
      sortOrder: 1,
    },
    {
      slug: "daycare",
      name: "Day Care",
      description:
        "Drop off before 9am and collect at 12:30pm (£15 half day) or 5pm (£26 full day) — a full day of care and exercise.",
      pricingModel: "PER_DAY" as const,
      basePricePence: 2600,
      sortOrder: 2,
    },
    {
      slug: "secure-forest-walks",
      name: "Secure Forest Walks",
      description:
        "Private-hire securely enclosed woodland for off-lead exercise — 1 hour for £15 or 3 hours for £20.",
      pricingModel: "PER_SESSION" as const,
      basePricePence: 1500,
      sortOrder: 3,
    },
    {
      slug: "overnight-boarding",
      name: "Home Boarding",
      description:
        "Safe, comfortable overnight stays in our secure countryside setting, with a discount for a second dog sharing.",
      pricingModel: "PER_NIGHT" as const,
      basePricePence: 5000,
      sortOrder: 4,
      requiresTrial: true,
    },
    {
      slug: "dog-walking",
      name: "Dog Walking",
      description:
        "Regular dog walking with van collection and drop-off from your home, with a discount for recurring weekly slots.",
      pricingModel: "PER_SESSION" as const,
      basePricePence: 1500,
      sortOrder: 5,
    },
  ]
  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: { requiresTrial: service.requiresTrial ?? false },
      create: service,
    })
  }

  const settings = [
    { key: "deposit_percent", value: "25" },
    { key: "balance_due_days_before_checkin", value: "7" },
    { key: "cancellation_free_days", value: "14" },
    { key: "cancellation_no_refund_hours", value: "48" },
    { key: "vat_enabled", value: "false" },
    { key: "pupdates_included_free", value: "true" },
    { key: "waitlist_offer_hours", value: "12" },
    { key: "subscription_pause_notice_days", value: "3" },
    { key: "abandoned_booking_reminder_hours", value: "2" },
    { key: "abandoned_booking_second_nudge_hours", value: "24" },
    {
      key: "opening_hours",
      value: "Mon–Fri 8am–6pm · Closed Saturday & Sunday · Drop-offs and collections by appointment",
    },
    { key: "business_name", value: "Bedlay Gardens Kennels" },
    { key: "business_tagline", value: "Professional dog boarding you can trust" },
    { key: "business_phone", value: "07956 301170" },
    { key: "business_email", value: "bedlaygardensdogforest@gmail.com" },
    { key: "business_address_line1", value: "Bedlay Gardens" },
    { key: "business_address_line2", value: "Cumbernauld Road, Chryston, Glasgow" },
    { key: "business_postcode", value: "G69 9HP" },
    { key: "business_lat", value: "55.9106" },
    { key: "business_lng", value: "-4.0800" },
    { key: "daycare_max_capacity", value: "10" },
    { key: "meet_greet_max_capacity", value: "4" },
    { key: "required_vaccine_types", value: "DHPP,Leptospirosis,Kennel Cough" },
    { key: "dog_walking_service_postcodes", value: "G69,G66,G64,G33,G68,G21" },
    { key: "second_dog_discount_percent", value: "20" },
  ]
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
  }

  const faqs = [
    {
      question: "What vaccinations does my dog need before boarding?",
      answer:
        "Your dog needs valid, in-date DHPP, leptospirosis and kennel cough vaccinations covering the full length of the stay. You can upload certificates or enter details manually in your account.",
      sortOrder: 1,
    },
    {
      question: "How do I book a dog walking collection?",
      answer:
        "Select Dog Walking in the booking flow, choose a van run with free capacity, and confirm your pickup address and access notes.",
      sortOrder: 2,
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Cancellations 14 or more days before check-in receive a full refund. Within 14 days the deposit is forfeit, and within 48 hours no refund is given.",
      sortOrder: 3,
    },
    {
      question: "Can two dogs share a kennel?",
      answer:
        "Yes — our medium and large kennels can house two dogs from the same family at a discounted per-night rate, provided neither dog has a 'no shared kennel' flag on their profile.",
      sortOrder: 4,
    },
  ]
  for (const faq of faqs) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } })
    if (!existing) {
      await prisma.faq.create({ data: faq })
    }
  }

  const testimonials = [
    {
      author: "Fiona M.",
      text: "Our spaniel comes home from Bedlay Gardens happier and more tired out than after any other kennels we've tried. The forest walks make all the difference.",
    },
    {
      author: "Graham & Susan",
      text: "The van pickup for weekly walks has been brilliant for our schedules — always on time, and we get a photo update every session.",
    },
    {
      author: "Priya K.",
      text: "Booking online took minutes and the staff clearly knew every detail of our dog's routine at check-in. Thoroughly recommend.",
    },
  ]
  for (const testimonial of testimonials) {
    const existing = await prisma.testimonial.findFirst({ where: { author: testimonial.author } })
    if (!existing) {
      await prisma.testimonial.create({ data: testimonial })
    }
  }

  const boarding = await prisma.service.findUnique({ where: { slug: "overnight-boarding" } })
  if (boarding) {
    const addons = [
      { name: "Extra playtime session", description: "20 minutes of 1:1 play with a staff member", pricePence: 500 },
      { name: "Birthday treat pack", description: "A small gift and treats for a birthday stay", pricePence: 350 },
    ]
    for (const addon of addons) {
      const existing = await prisma.addon.findFirst({ where: { name: addon.name, serviceId: boarding.id } })
      if (!existing) {
        await prisma.addon.create({ data: { ...addon, serviceId: boarding.id } })
      }
    }
  }

  const mediaItems: {
    url: string
    category: string
    caption: string
    altText: string
    sortOrder: number
    usage: "GALLERY" | "HERO" | "ABOUT"
  }[] = [
    {
      url: "/images/placeholders/hero.svg",
      category: "kennels",
      caption: "Bedlay Gardens Kennels",
      altText: "Illustrated placeholder banner for Bedlay Gardens Kennels",
      sortOrder: 0,
      usage: "HERO",
    },
    {
      url: "/images/placeholders/kennels-1.svg",
      category: "kennels",
      caption: "Our kennel block",
      altText: "Placeholder image representing the kennel block",
      sortOrder: 1,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/kennels-2.svg",
      category: "kennels",
      caption: "Individual kennel run",
      altText: "Placeholder image representing an individual kennel run",
      sortOrder: 2,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/forest-walks-1.svg",
      category: "forest walks",
      caption: "Secure forest walk",
      altText: "Placeholder image representing a secure forest walk",
      sortOrder: 3,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/forest-walks-2.svg",
      category: "forest walks",
      caption: "Woodland session",
      altText: "Placeholder image representing a woodland walking session",
      sortOrder: 4,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/van-runs-1.svg",
      category: "van runs",
      caption: "Collection van",
      altText: "Placeholder image representing the dog walking collection van",
      sortOrder: 5,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/van-runs-2.svg",
      category: "van runs",
      caption: "Morning run",
      altText: "Placeholder image representing a morning van run",
      sortOrder: 6,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/happy-guests-1.svg",
      category: "happy guests",
      caption: "A happy guest",
      altText: "Placeholder image representing a happy dog guest",
      sortOrder: 7,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/happy-guests-2.svg",
      category: "happy guests",
      caption: "Another happy guest",
      altText: "Placeholder image representing a happy dog guest",
      sortOrder: 8,
      usage: "GALLERY",
    },
    {
      url: "/images/placeholders/about-team.svg",
      category: "about",
      caption: "Our team",
      altText: "Placeholder image representing the Bedlay Gardens team",
      sortOrder: 9,
      usage: "ABOUT",
    },
    {
      url: "/images/placeholders/about-facility.svg",
      category: "about",
      caption: "Our facility",
      altText: "Placeholder image representing the Bedlay Gardens facility",
      sortOrder: 10,
      usage: "ABOUT",
    },
  ]
  for (const media of mediaItems) {
    const existing = await prisma.mediaItem.findFirst({ where: { url: media.url } })
    if (!existing) {
      await prisma.mediaItem.create({ data: { ...media, type: "IMAGE" } })
    }
  }

  function daysFromNow(days: number): Date {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + days)
    return date
  }

  for (let day = 1; day <= 14; day++) {
    const date = daysFromNow(day)
    const slots = [
      { time: "10:00", durationMin: 30, maxDogs: 4 },
      { time: "14:00", durationMin: 60, maxDogs: 3 },
    ]
    for (const slot of slots) {
      const existing = await prisma.walkSlot.findFirst({ where: { date, time: slot.time } })
      if (!existing) {
        await prisma.walkSlot.create({ data: { date, ...slot } })
      }
    }

    const runs = [
      { name: "Morning run", startTime: "08:30", maxDogs: 6 },
      { name: "Afternoon run", startTime: "13:00", maxDogs: 6 },
    ]
    for (const run of runs) {
      const existing = await prisma.vanRun.findFirst({ where: { date, name: run.name } })
      if (!existing) {
        await prisma.vanRun.create({ data: { date, ...run } })
      }
    }
  }

  console.log("Seed complete.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
