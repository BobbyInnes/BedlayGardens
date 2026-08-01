import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { formatPence } from "@/lib/format"
import { ToggleActiveButton } from "@/components/admin/toggle-active-button"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import { CustomerNotesForm } from "@/components/admin/customer-notes-form"
import { GoodwillCreditForm } from "@/components/admin/goodwill-credit-form"
import { PromoteCustomerForm } from "@/components/admin/promote-customer-form"
import { CustomerPetExplorer, type ExplorerDog } from "@/components/admin/customer-pet-explorer"
import { toggleCustomerActive, deleteCustomer } from "@/app/admin/customers/actions"
import { getAvailableCreditPence } from "@/lib/vouchers"
import { canManageAdmins } from "@/lib/admin-permissions"
import { TRIAL_OUTCOME_LABELS } from "@/lib/trial-outcome"

export const metadata: Metadata = {
  title: "Customer | Admin",
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const [session, customer] = await Promise.all([
    auth(),
    prisma.user.findFirst({
      where: { id: customerId, role: "CUSTOMER" },
      include: {
        dogs: {
          orderBy: { name: "asc" },
          include: {
            flags: true,
            vaccinationRecords: { orderBy: { expiryDate: "desc" } },
            trialVisits: { orderBy: { completedAt: "desc" }, take: 1, where: { outcome: { not: null } } },
            bookingDogs: {
              include: { booking: { include: { service: true, kennelUnit: true } } },
            },
          },
        },
        _count: { select: { bookings: true } },
      },
    }),
  ])
  if (!customer) notFound()
  const creditBalancePence = await getAvailableCreditPence(customer.id)
  const viewerCanManageAdmins = session ? await canManageAdmins(session) : false

  const addressLabel =
    customer.addressLine1 || customer.addressCity || customer.addressPostcode
      ? [
          customer.addressLine1,
          customer.addressLine2,
          customer.addressCity,
          customer.addressPostcode,
        ]
          .filter(Boolean)
          .join(", ")
      : null

  const explorerDogs: ExplorerDog[] = customer.dogs.map((dog) => {
    const latestOutcome = dog.trialVisits[0]
    const bookings = [...dog.bookingDogs]
      .sort((a, b) => b.booking.startDate.getTime() - a.booking.startDate.getTime())
      .map(({ booking }) => ({
        id: booking.id,
        label: booking.kennelUnit ? `${booking.service.name} · ${booking.kennelUnit.name}` : booking.service.name,
        dateLabel:
          booking.endDate.getTime() !== booking.startDate.getTime()
            ? `${booking.startDate.toLocaleDateString("en-GB")} – ${booking.endDate.toLocaleDateString("en-GB")}`
            : booking.startDate.toLocaleDateString("en-GB"),
        statusLabel: booking.status.replace(/_/g, " "),
        totalLabel: formatPence(booking.totalPence),
      }))

    return {
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      sex: dog.sex,
      size: dog.size,
      neutered: dog.neutered,
      weightKg: dog.weightKg,
      dobLabel: dog.dob ? dog.dob.toLocaleDateString("en-GB") : "—",
      vetLabel: dog.vetName ? `${dog.vetName}${dog.vetPhone ? ` (${dog.vetPhone})` : ""}` : null,
      emergencyContact: dog.emergencyContact,
      feedingNotes: dog.feedingNotes,
      medicationNotes: dog.medicationNotes,
      behaviourNotes: dog.behaviourNotes,
      meetGreetLabel: latestOutcome ? TRIAL_OUTCOME_LABELS[latestOutcome.outcome!] : "Not yet done",
      meetGreetVariant: latestOutcome
        ? latestOutcome.outcome === "PASSED"
          ? "default"
          : "destructive"
        : "outline",
      flags: dog.flags,
      vaccinations: dog.vaccinationRecords.map((record) => ({
        id: record.id,
        type: record.type,
        status: record.status,
        expiryLabel: record.expiryDate.toLocaleDateString("en-GB"),
      })),
      bookings,
    }
  })

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={customer.active ? "secondary" : "destructive"}>
            {customer.active ? "Active" : "Banned"}
          </Badge>
          <ToggleActiveButton
            active={customer.active}
            onToggle={toggleCustomerActive.bind(null, customer.id)}
          />
        </div>
      </div>

      <CustomerPetExplorer
        customer={{
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          workPhone: customer.workPhone,
          addressLabel,
          customerSinceLabel: customer.createdAt.toLocaleDateString("en-GB"),
        }}
        dogs={explorerDogs}
      />

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Admin notes</h2>
        <CustomerNotesForm customerId={customer.id} notes={customer.adminNotes ?? ""} />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Promote to staff</h2>
        <p className="text-sm text-muted-foreground">
          Converts this customer account into a staff or admin login, keeping their existing
          password. You&rsquo;ll be taken to the staff edit page afterwards to add a job title,
          photo, and bio.
        </p>
        <PromoteCustomerForm customerId={customer.id} viewerCanManageAdmins={viewerCanManageAdmins} />
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">
          Account credit — {formatPence(creditBalancePence)}
        </h2>
        <GoodwillCreditForm customerId={customer.id} />
      </section>

      {session?.user.isSuperAdmin && (
        <section className="space-y-3 rounded-lg border border-destructive/50 p-4">
          <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
          <p className="text-sm text-muted-foreground">
            Permanently deletes this customer, all {customer.dogs.length} dog(s), and all{" "}
            {customer._count.bookings} booking(s). This cannot be undone.
          </p>
          <ConfirmDeleteButton
            label="Delete customer"
            title={`Delete ${customer.name}?`}
            description={`This will permanently delete ${customer.name}, their ${customer.dogs.length} dog(s), and their ${customer._count.bookings} booking(s). This cannot be undone.`}
            onConfirm={deleteCustomer.bind(null, customer.id)}
          />
        </section>
      )}

      <Link href="/admin/customers" className="inline-block text-sm font-medium text-primary hover:underline">
        ← Back to customers
      </Link>
    </div>
  )
}
