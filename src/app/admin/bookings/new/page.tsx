import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { ManualBookingForm } from "@/components/admin/manual-booking-form"

export const metadata: Metadata = {
  title: "New Booking | Admin",
}

export default async function NewManualBookingPage() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, pricingModel: true },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create manual booking</h1>
      <ManualBookingForm services={services} />
    </div>
  )
}
