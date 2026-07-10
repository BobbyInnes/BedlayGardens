import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

async function main() {
  const adminPasswordHash = await bcrypt.hash("ChangeMe123!", 10)
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

  const services = [
    {
      slug: "overnight-boarding",
      name: "Overnight Boarding",
      description:
        "Multi-night kennel stays in our secure countryside kennels, with a discount for a second dog sharing a kennel.",
      pricingModel: "PER_NIGHT" as const,
      basePricePence: 3500,
      sortOrder: 1,
    },
    {
      slug: "daycare",
      name: "Daycare",
      description:
        "Day visits with morning drop-off and evening pick-up. Half-day rate available.",
      pricingModel: "PER_DAY" as const,
      basePricePence: 2000,
      sortOrder: 2,
    },
    {
      slug: "secure-forest-walks",
      name: "Secure Forest Walks",
      description:
        "Escorted walks in enclosed private woodland, bookable as an add-on to a stay or as a standalone session.",
      pricingModel: "PER_SESSION" as const,
      basePricePence: 1000,
      sortOrder: 3,
    },
    {
      slug: "dog-walking",
      name: "Dog Walking",
      description:
        "Regular dog walking with van collection and drop-off from your home, with a discount for recurring weekly slots.",
      pricingModel: "PER_SESSION" as const,
      basePricePence: 1500,
      sortOrder: 4,
    },
  ]
  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: {},
      create: service,
    })
  }

  const settings = [
    { key: "deposit_percent", value: "25" },
    { key: "balance_due_days_before_checkin", value: "7" },
    { key: "cancellation_free_days", value: "14" },
    { key: "cancellation_no_refund_hours", value: "48" },
    { key: "vat_enabled", value: "false" },
    { key: "opening_hours", value: "Mon-Sun 8:00-18:00" },
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
  ]
  for (const faq of faqs) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } })
    if (!existing) {
      await prisma.faq.create({ data: faq })
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
