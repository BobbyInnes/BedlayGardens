import { PrismaNeon } from "@prisma/adapter-neon"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../../src/generated/prisma/client"
import { E2E_CUSTOMER_EMAIL, E2E_CUSTOMER_PASSWORD, E2E_DOG_NAME } from "./fixtures"

async function seed() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  const existing = await prisma.user.findUnique({ where: { email: E2E_CUSTOMER_EMAIL } })
  if (existing) {
    await prisma.booking.deleteMany({ where: { customerId: existing.id } })
    await prisma.dog.deleteMany({ where: { ownerId: existing.id } })
    await prisma.user.delete({ where: { id: existing.id } })
  }

  const passwordHash = await bcrypt.hash(E2E_CUSTOMER_PASSWORD, 10)
  const customer = await prisma.user.create({
    data: {
      name: "E2E Customer",
      email: E2E_CUSTOMER_EMAIL,
      passwordHash,
      role: "CUSTOMER",
      emailVerified: new Date(),
    },
  })

  const dog = await prisma.dog.create({
    data: { ownerId: customer.id, name: E2E_DOG_NAME, breed: "Labrador" },
  })

  const farFutureExpiry = new Date()
  farFutureExpiry.setFullYear(farFutureExpiry.getFullYear() + 1)
  for (const type of ["DHPP", "Leptospirosis", "Kennel Cough"]) {
    await prisma.vaccinationRecord.create({
      data: {
        dogId: dog.id,
        type,
        dateGiven: new Date(),
        expiryDate: farFutureExpiry,
        status: "VERIFIED",
      },
    })
  }

  console.log("[e2e seed] created test customer:", customer.id)
  await prisma.$disconnect()
}

seed()
