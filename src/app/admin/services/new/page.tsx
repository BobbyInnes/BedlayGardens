import type { Metadata } from "next"
import { ServiceForm } from "@/components/admin/service-form"
import { createService } from "@/app/admin/services/actions"

export const metadata: Metadata = {
  title: "Add Service | Admin",
}

export default function NewServicePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add service</h1>
      <ServiceForm action={createService} submitLabel="Create service" />
    </div>
  )
}
