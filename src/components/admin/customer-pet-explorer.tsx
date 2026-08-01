"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { DogFlagsManager } from "@/components/admin/dog-flags-manager"
import { cn } from "@/lib/utils"
import type { DogFlagType, TrialOutcome, VaccinationStatus } from "@/generated/prisma/client"

const VACCINATION_STATUS_LABELS: Record<VaccinationStatus, string> = {
  UNVERIFIED: "Unverified",
  VERIFIED: "Verified",
  EXPIRED: "Expired",
}

const TRIAL_OUTCOME_LABELS: Record<TrialOutcome, string> = {
  PASSED: "Passed",
  RETRY: "Needs another visit",
  NOT_SUITABLE: "Not suitable",
}

export type ExplorerVaccination = {
  id: string
  type: string
  status: VaccinationStatus
  expiryLabel: string
}

export type ExplorerBooking = {
  id: string
  label: string
  dateLabel: string
  statusLabel: string
  totalLabel: string
}

export type ExplorerFlag = { id: string; type: DogFlagType; notes: string | null }

export type ExplorerDog = {
  id: string
  name: string
  breed: string
  sex: string | null
  size: string | null
  neutered: boolean
  weightKg: number | null
  dobLabel: string
  vetLabel: string | null
  emergencyContact: string | null
  feedingNotes: string | null
  medicationNotes: string | null
  behaviourNotes: string | null
  meetGreetLabel: string
  meetGreetVariant: "default" | "destructive" | "outline"
  flags: ExplorerFlag[]
  vaccinations: ExplorerVaccination[]
  bookings: ExplorerBooking[]
}

export type ExplorerCustomer = {
  id: string
  name: string
  email: string
  phone: string | null
  workPhone: string | null
  addressLabel: string | null
  customerSinceLabel: string
}

function vaccinationBadgeVariant(status: VaccinationStatus) {
  if (status === "VERIFIED") return "default"
  if (status === "EXPIRED") return "destructive"
  return "outline"
}

export function CustomerPetExplorer({
  customer,
  dogs,
}: {
  customer: ExplorerCustomer
  dogs: ExplorerDog[]
}) {
  const [selectedDogId, setSelectedDogId] = React.useState(dogs[0]?.id ?? null)
  const selectedDog = dogs.find((dog) => dog.id === selectedDogId) ?? dogs[0] ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Customer</h2>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Name</dt>
            <dd className="font-medium">{customer.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Customer ID</dt>
            <dd className="font-mono text-xs">{customer.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd>{customer.phone || "—"}</dd>
          </div>
          {customer.workPhone && (
            <div>
              <dt className="text-xs text-muted-foreground">Work phone</dt>
              <dd>{customer.workPhone}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd>{customer.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Address</dt>
            <dd>{customer.addressLabel || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Customer since</dt>
            <dd>{customer.customerSinceLabel}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Dogs ({dogs.length})</h2>
        {dogs.length > 0 ? (
          <ul className="space-y-1">
            {dogs.map((dog) => (
              <li key={dog.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDogId(dog.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted",
                    dog.id === selectedDog?.id
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {dog.name} <span className="text-muted-foreground">— {dog.breed}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No dog profiles yet.</p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">Selected pet details</h2>
        {selectedDog ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">
                {selectedDog.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {selectedDog.sex ? (selectedDog.sex === "MALE" ? "Male" : "Female") : "Sex unknown"}
                  {" · "}
                  {selectedDog.neutered ? "Neutered/spayed" : "Not neutered/spayed"}
                  {selectedDog.size ? ` · ${selectedDog.size.toLowerCase()}` : ""}
                  {selectedDog.weightKg ? ` · ${selectedDog.weightKg} kg` : ""}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">DOB: {selectedDog.dobLabel}</p>
              {selectedDog.vetLabel && (
                <p className="text-xs text-muted-foreground">Vet: {selectedDog.vetLabel}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={selectedDog.meetGreetVariant}>
                Meet &amp; Greet: {selectedDog.meetGreetLabel}
              </Badge>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Vaccines ({selectedDog.vaccinations.length})
              </p>
              {selectedDog.vaccinations.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {selectedDog.vaccinations.map((record) => (
                    <Badge key={record.id} variant={vaccinationBadgeVariant(record.status)}>
                      {record.type}: {VACCINATION_STATUS_LABELS[record.status]} (exp {record.expiryLabel})
                    </Badge>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No vaccination records.</p>
              )}
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Bookings ({selectedDog.bookings.length})
              </p>
              {selectedDog.bookings.length > 0 ? (
                <ul className="space-y-1.5">
                  {selectedDog.bookings.map((booking) => (
                    <li key={booking.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p>{booking.label}</p>
                        <p className="text-xs text-muted-foreground">{booking.dateLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{booking.totalLabel}</span>
                        <Badge variant="outline">{booking.statusLabel}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No bookings yet.</p>
              )}
            </div>

            {(selectedDog.feedingNotes || selectedDog.medicationNotes || selectedDog.behaviourNotes || selectedDog.emergencyContact) && (
              <div className="space-y-1 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground">Special instructions</p>
                {selectedDog.feedingNotes && <p>Feeding: {selectedDog.feedingNotes}</p>}
                {selectedDog.medicationNotes && <p>Medication: {selectedDog.medicationNotes}</p>}
                {selectedDog.behaviourNotes && <p>Behaviour: {selectedDog.behaviourNotes}</p>}
                {selectedDog.emergencyContact && <p>Emergency contact: {selectedDog.emergencyContact}</p>}
              </div>
            )}

            <div className="border-t border-border pt-3">
              <DogFlagsManager
                customerId={customer.id}
                dogId={selectedDog.id}
                dogName={selectedDog.name}
                flags={selectedDog.flags}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No dog profiles yet.</p>
        )}
      </section>
    </div>
  )
}
