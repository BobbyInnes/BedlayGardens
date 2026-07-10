"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  searchCustomers,
  getCustomerDogs,
  createQuickCustomer,
  createQuickDog,
  createManualBooking,
} from "@/app/admin/bookings/actions"

type PricingModel = "PER_NIGHT" | "PER_DAY" | "PER_SESSION"
type ServiceInfo = { id: string; slug: string; name: string; pricingModel: PricingModel }
type Customer = { id: string; name: string; email: string; phone: string | null }
type DogOption = { id: string; name: string; breed: string }
type WalkSlotOption = { id: string; date: string; time: string; durationMin: number; remaining: number }
type VanRunOption = { id: string; date: string; name: string; startTime: string; remaining: number }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ManualBookingForm({ services }: { services: ServiceInfo[] }) {
  // Customer selection
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Customer[]>([])
  const [searching, setSearching] = React.useState(false)
  const [customer, setCustomer] = React.useState<Customer | null>(null)
  const [showNewCustomer, setShowNewCustomer] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [newPhone, setNewPhone] = React.useState("")
  const [customerError, setCustomerError] = React.useState<string | null>(null)

  // Dogs
  const [dogs, setDogs] = React.useState<DogOption[]>([])
  const [selectedDogIds, setSelectedDogIds] = React.useState<string[]>([])
  const [showNewDog, setShowNewDog] = React.useState(false)
  const [newDogName, setNewDogName] = React.useState("")
  const [newDogBreed, setNewDogBreed] = React.useState("")

  // Service + dates
  const [serviceSlug, setServiceSlug] = React.useState("")
  const [startDate, setStartDate] = React.useState(todayISO())
  const [endDate, setEndDate] = React.useState("")
  const [date, setDate] = React.useState(todayISO())
  const [walkSlots, setWalkSlots] = React.useState<WalkSlotOption[]>([])
  const [selectedSlotId, setSelectedSlotId] = React.useState("")
  const [vanRuns, setVanRuns] = React.useState<VanRunOption[]>([])
  const [selectedRunId, setSelectedRunId] = React.useState("")
  const [pickupAddress, setPickupAddress] = React.useState("")
  const [postcode, setPostcode] = React.useState("")
  const [accessNotes, setAccessNotes] = React.useState("")

  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const isBoarding = serviceSlug === "overnight-boarding"
  const isDaycare = serviceSlug === "daycare"
  const isForestWalk = serviceSlug === "secure-forest-walks"
  const isDogWalking = serviceSlug === "dog-walking"

  async function runSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const matches = await searchCustomers(value)
      setResults(matches)
    } finally {
      setSearching(false)
    }
  }

  async function selectCustomer(c: Customer) {
    setCustomer(c)
    setResults([])
    const customerDogs = await getCustomerDogs(c.id)
    setDogs(customerDogs)
  }

  async function submitNewCustomer() {
    setCustomerError(null)
    const result = await createQuickCustomer({ name: newName, email: newEmail, phone: newPhone })
    if (result.status === "error") {
      setCustomerError(result.message ?? "Could not create customer.")
      return
    }
    if (result.customer) {
      setCustomer(result.customer)
      setDogs([])
      setShowNewCustomer(false)
    }
  }

  async function submitNewDog() {
    if (!customer) return
    const result = await createQuickDog({ ownerId: customer.id, name: newDogName, breed: newDogBreed })
    if (result.dog) {
      setDogs((prev) => [...prev, result.dog!])
      setSelectedDogIds((prev) => [...prev, result.dog!.id])
      setNewDogName("")
      setNewDogBreed("")
      setShowNewDog(false)
    }
  }

  function onServiceChange(slug: string) {
    setServiceSlug(slug)
    if (slug === "secure-forest-walks") {
      fetch(`/api/book/availability?serviceSlug=${slug}`)
        .then((res) => res.json())
        .then((data) => setWalkSlots(data.slots ?? []))
    }
    if (slug === "dog-walking") {
      fetch(`/api/book/availability?serviceSlug=${slug}`)
        .then((res) => res.json())
        .then((data) => setVanRuns(data.runs ?? []))
    }
  }

  function toggleDog(dogId: string) {
    setSelectedDogIds((prev) =>
      prev.includes(dogId) ? prev.filter((id) => id !== dogId) : [...prev, dogId]
    )
  }

  async function handleSubmit() {
    if (!customer) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await createManualBooking({
        customerId: customer.id,
        serviceSlug,
        dogIds: selectedDogIds,
        startDate: isBoarding ? startDate : undefined,
        endDate: isBoarding ? endDate : undefined,
        date: isDaycare ? date : undefined,
        walkSlotId: isForestWalk ? selectedSlotId : undefined,
        vanRunId: isDogWalking ? selectedRunId : undefined,
        pickupAddress: isDogWalking ? pickupAddress : undefined,
        accessNotes: isDogWalking ? accessNotes : undefined,
        postcode: isDogWalking ? postcode : undefined,
      })
      if (result?.status === "error") {
        setSubmitError(result.message ?? "Something went wrong.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    !!customer &&
    selectedDogIds.length > 0 &&
    !!serviceSlug &&
    (isBoarding
      ? !!startDate && !!endDate
      : isDaycare
        ? !!date
        : isForestWalk
          ? !!selectedSlotId
          : isDogWalking
            ? !!selectedRunId && !!pickupAddress
            : false)

  return (
    <div className="max-w-2xl space-y-8">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold">1. Customer</h2>
        {customer ? (
          <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
            <div>
              <p className="font-medium">{customer.name}</p>
              <p className="text-muted-foreground">{customer.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomer(null)
                setDogs([])
                setSelectedDogIds([])
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="customerSearch">Search by name or email</Label>
              <Input
                id="customerSearch"
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            {searching && <p className="text-sm text-muted-foreground">Searching…</p>}
            {results.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(r)}
                      className="flex w-full items-center justify-between p-2 text-left text-sm hover:bg-muted"
                    >
                      <span>{r.name}</span>
                      <span className="text-muted-foreground">{r.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!showNewCustomer ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCustomer(true)}>
                New phone customer
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label htmlFor="newName">Name</Label>
                  <Input id="newName" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newEmail">Email</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPhone">Phone</Label>
                  <Input id="newPhone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewCustomer(false)}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={submitNewCustomer}>
                    Create customer
                  </Button>
                </div>
                {customerError && <p className="text-sm text-destructive">{customerError}</p>}
              </div>
            )}
          </div>
        )}
      </section>

      {customer && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">2. Dogs</h2>
          {dogs.length > 0 ? (
            <ul className="space-y-2">
              {dogs.map((dog) => (
                <li key={dog.id}>
                  <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={selectedDogIds.includes(dog.id)}
                      onChange={() => toggleDog(dog.id)}
                    />
                    <span>
                      {dog.name} <span className="text-muted-foreground">— {dog.breed}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">This customer has no dog profiles yet.</p>
          )}

          {!showNewDog ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowNewDog(true)}>
              Add a dog
            </Button>
          ) : (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-2">
                <Label htmlFor="newDogName">Name</Label>
                <Input id="newDogName" value={newDogName} onChange={(e) => setNewDogName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newDogBreed">Breed</Label>
                <Input
                  id="newDogBreed"
                  value={newDogBreed}
                  onChange={(e) => setNewDogBreed(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewDog(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={submitNewDog}
                  disabled={!newDogName.trim() || !newDogBreed.trim()}
                >
                  Add dog
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {customer && (
        <section className="space-y-4 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">3. Service &amp; dates</h2>
          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select value={serviceSlug} onValueChange={onServiceChange}>
              <SelectTrigger id="service" className="w-full">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.slug}>
                    {svc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isBoarding && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Check-in</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Check-out</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {isDaycare && (
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}

          {isForestWalk && (
            <div className="space-y-2">
              <Label>Choose a session</Label>
              {walkSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions available right now.</p>
              ) : (
                <div className="space-y-2">
                  {walkSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm ${
                        selectedSlotId === slot.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <span>
                        {new Date(slot.date).toLocaleDateString("en-GB")} at {slot.time} (
                        {slot.durationMin} min)
                      </span>
                      <span className="text-muted-foreground">{slot.remaining} spaces left</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isDogWalking && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Choose a van run</Label>
                {vanRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No runs available right now.</p>
                ) : (
                  <div className="space-y-2">
                    {vanRuns.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                        className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm ${
                          selectedRunId === run.id ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <span>
                          {run.name} — {new Date(run.date).toLocaleDateString("en-GB")} at{" "}
                          {run.startTime}
                        </span>
                        <span className="text-muted-foreground">{run.remaining} spaces left</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupAddress">Pickup address</Label>
                <Input
                  id="pickupAddress"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessNotes">Access notes (optional)</Label>
                <Textarea
                  id="accessNotes"
                  value={accessNotes}
                  onChange={(e) => setAccessNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {customer && serviceSlug && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Vaccination checks are skipped for phone bookings created here — they&rsquo;ll be verified at
            check-in as normal.
          </p>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Creating…" : "Create booking"}
          </Button>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
      )}
    </div>
  )
}
