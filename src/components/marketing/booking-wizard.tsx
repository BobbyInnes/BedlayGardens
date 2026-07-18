"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatPence } from "@/lib/format"
import { createBooking, type BookingActionState } from "@/app/(marketing)/book/actions"
import { joinWaitlist } from "@/app/portal/waitlist/actions"

type PricingModel = "PER_NIGHT" | "PER_DAY" | "PER_SESSION"
type PaymentTiming = "FULL_UPFRONT" | "DEPOSIT_THEN_BALANCE" | "INVOICE_AFTER"

type ServiceInfo = {
  id: string
  slug: string
  name: string
  pricingModel: PricingModel
  basePricePence: number
  paymentTiming: PaymentTiming
}

type DogInfo = { id: string; name: string; breed: string }
type AddonInfo = { id: string; name: string; description: string | null; pricePence: number }

type WalkSlotOption = { id: string; date: string; time: string; durationMin: number; remaining: number }
type VanRunOption = { id: string; date: string; name: string; startTime: string; remaining: number }

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nightsBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}

export function BookingWizard({
  service,
  dogs,
  addons,
  depositPercent,
  secondDogDiscountPercent,
}: {
  service: ServiceInfo
  dogs: DogInfo[]
  addons: AddonInfo[]
  depositPercent: number
  secondDogDiscountPercent: number
}) {
  const isBoarding = service.slug === "overnight-boarding"
  const isDaycare = service.slug === "daycare"
  const isMeetGreet = service.slug === "meet-greet"
  const isForestWalk = service.slug === "secure-forest-walks"
  const isDogWalking = service.slug === "dog-walking"
  const isDateBased = isDaycare || isMeetGreet

  const steps = isBoarding
    ? (["dates", "dogs", "addons", "review"] as const)
    : (["dates", "dogs", "review"] as const)
  const [stepIndex, setStepIndex] = React.useState(0)
  const step = steps[stepIndex]

  // Dates / slot selection state
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

  const [availabilityChecked, setAvailabilityChecked] = React.useState(false)
  const [available, setAvailable] = React.useState<boolean | null>(null)
  const [availabilityReason, setAvailabilityReason] = React.useState<string | null>(null)
  const [checkingAvailability, setCheckingAvailability] = React.useState(false)
  const [waitlistDogId, setWaitlistDogId] = React.useState("")
  const [waitlistMessage, setWaitlistMessage] = React.useState<string | null>(null)
  const [joiningWaitlist, setJoiningWaitlist] = React.useState(false)

  // Dogs
  const [selectedDogIds, setSelectedDogIds] = React.useState<string[]>([])
  const [vaccinationWarning, setVaccinationWarning] = React.useState<
    { dogName: string; missingTypes: string[] }[] | null
  >(null)
  const [checkingVaccinations, setCheckingVaccinations] = React.useState(false)
  const [trialWarning, setTrialWarning] = React.useState<string[] | null>(null)
  const [checkingTrial, setCheckingTrial] = React.useState(false)

  // Addons
  const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([])

  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [requiresTrialVisit, setRequiresTrialVisit] = React.useState(false)

  const dogCount = selectedDogIds.length || 1

  React.useEffect(() => {
    if (isForestWalk) {
      fetch(`/api/book/availability?serviceSlug=${service.slug}`)
        .then((res) => res.json())
        .then((data) => setWalkSlots(data.slots ?? []))
    }
    if (isDogWalking) {
      fetch(`/api/book/availability?serviceSlug=${service.slug}`)
        .then((res) => res.json())
        .then((data) => setVanRuns(data.runs ?? []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAvailability() {
    setCheckingAvailability(true)
    setAvailabilityChecked(false)
    try {
      if (isBoarding) {
        const params = new URLSearchParams({
          serviceSlug: service.slug,
          startDate,
          endDate,
          dogCount: String(dogCount),
        })
        const res = await fetch(`/api/book/availability?${params}`)
        const data = await res.json()
        setAvailable(!!data.available)
        setAvailabilityReason(null)
      } else if (isDateBased) {
        const params = new URLSearchParams({ serviceSlug: service.slug, date })
        const res = await fetch(`/api/book/availability?${params}`)
        const data = await res.json()
        setAvailable(!!data.available)
        setAvailabilityReason(data.reason ?? null)
      }
      setAvailabilityChecked(true)
      setWaitlistMessage(null)
    } finally {
      setCheckingAvailability(false)
    }
  }

  async function handleJoinWaitlist() {
    const dogId = dogs.length === 1 ? dogs[0].id : waitlistDogId
    if (!dogId) return
    setJoiningWaitlist(true)
    try {
      const result = await joinWaitlist(service.slug, dogId, date)
      setWaitlistMessage(result.message ?? null)
    } finally {
      setJoiningWaitlist(false)
    }
  }

  function toggleDog(dogId: string) {
    setSelectedDogIds((prev) =>
      prev.includes(dogId) ? prev.filter((id) => id !== dogId) : [...prev, dogId]
    )
  }

  function toggleAddon(addonId: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    )
  }

  async function goToReviewFromDogs() {
    setTrialWarning(null)
    setCheckingTrial(true)
    try {
      const trialParams = new URLSearchParams({ serviceSlug: service.slug })
      for (const dogId of selectedDogIds) trialParams.append("dogId", dogId)
      const trialRes = await fetch(`/api/book/trial-check?${trialParams}`)
      const trialData = await trialRes.json()
      if ((trialData.missing ?? []).length > 0) {
        setTrialWarning(trialData.missing)
        return
      }
    } finally {
      setCheckingTrial(false)
    }

    const throughDate = isBoarding
      ? endDate
      : isDaycare
        ? date
        : isMeetGreet
          ? undefined
          : isForestWalk
            ? walkSlots.find((s) => s.id === selectedSlotId)?.date
            : vanRuns.find((r) => r.id === selectedRunId)?.date

    if (!throughDate) {
      setStepIndex((i) => i + 1)
      return
    }

    setCheckingVaccinations(true)
    try {
      const params = new URLSearchParams({ throughDate })
      for (const dogId of selectedDogIds) params.append("dogId", dogId)
      const res = await fetch(`/api/book/vaccination-check?${params}`)
      const data = await res.json()
      const missing = (data.perDog ?? []).filter(
        (d: { missingTypes: string[] }) => d.missingTypes.length > 0
      )
      setVaccinationWarning(missing.length > 0 ? missing : null)
      if (missing.length === 0) setStepIndex((i) => i + 1)
    } finally {
      setCheckingVaccinations(false)
    }
  }

  // Client-side price preview mirroring the server's boarding discount logic.
  const nights = isBoarding ? nightsBetween(startDate, endDate) : 1
  const units = isBoarding ? nights : 1
  let basePreviewPence: number
  if (isBoarding && dogCount >= 2) {
    const firstDog = service.basePricePence * units
    const extraRate = service.basePricePence * (1 - secondDogDiscountPercent / 100)
    basePreviewPence = Math.round(firstDog + extraRate * units * (dogCount - 1))
  } else {
    basePreviewPence = service.basePricePence * units * dogCount
  }
  const addonsPreviewPence = selectedAddonIds.reduce((sum, id) => {
    const addon = addons.find((a) => a.id === id)
    return sum + (addon?.pricePence ?? 0)
  }, 0)
  const totalPreviewPence = basePreviewPence + addonsPreviewPence
  const depositPreviewPence = Math.round(totalPreviewPence * (depositPercent / 100))

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    setRequiresTrialVisit(false)
    try {
      const result: BookingActionState = await createBooking({
        serviceSlug: service.slug,
        dogIds: selectedDogIds,
        addons: selectedAddonIds.map((addonId) => ({ addonId, quantity: 1 })),
        startDate: isBoarding ? startDate : undefined,
        endDate: isBoarding ? endDate : undefined,
        date: isDateBased ? date : undefined,
        walkSlotId: isForestWalk ? selectedSlotId : undefined,
        vanRunId: isDogWalking ? selectedRunId : undefined,
        pickupAddress: isDogWalking ? pickupAddress : undefined,
        accessNotes: isDogWalking ? accessNotes : undefined,
        postcode: isDogWalking ? postcode : undefined,
      })
      if (result?.status === "error") {
        setSubmitError(result.message ?? "Something went wrong.")
        if (result.missingVaccinations) setVaccinationWarning(result.missingVaccinations)
        if (result.requiresTrialVisit) setRequiresTrialVisit(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <ol className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
        {steps.map((s, i) => (
          <li
            key={s}
            className={i === stepIndex ? "text-primary" : i < stepIndex ? "text-foreground" : ""}
          >
            {i + 1}. {s === "dates" ? "Dates" : s === "dogs" ? "Dogs" : s === "addons" ? "Add-ons" : "Review"}
            {i < steps.length - 1 && <span className="ml-2">→</span>}
          </li>
        ))}
      </ol>

      {step === "dates" && (
        <div className="space-y-5">
          {isBoarding && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Check-in</Label>
                <Input
                  id="startDate"
                  type="date"
                  min={todayISO()}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setAvailabilityChecked(false)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Check-out</Label>
                <Input
                  id="endDate"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setAvailabilityChecked(false)
                  }}
                />
              </div>
            </div>
          )}

          {isDateBased && (
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setAvailabilityChecked(false)
                }}
              />
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
            <div className="space-y-5">
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
                  placeholder="123 Example Street, Chryston"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="G69 0AA"
                />
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

          {(isBoarding || isDateBased) && (
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={checkAvailability}
                disabled={checkingAvailability || (isBoarding && (!startDate || !endDate))}
              >
                {checkingAvailability ? "Checking…" : "Check availability"}
              </Button>
              {availabilityChecked && (
                <p className={available ? "text-sm text-primary" : "text-sm text-destructive"}>
                  {available
                    ? "Available!"
                    : (availabilityReason ?? "Sorry, not available for these dates.")}
                </p>
              )}
              {availabilityChecked && !available && isDateBased && !availabilityReason && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">
                    Join the waitlist and we&rsquo;ll email you the moment a space opens up.
                  </p>
                  {dogs.length > 1 && (
                    <select
                      value={waitlistDogId}
                      onChange={(e) => setWaitlistDogId(e.target.value)}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    >
                      <option value="">Select a dog</option>
                      {dogs.map((dog) => (
                        <option key={dog.id} value={dog.id}>
                          {dog.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={joiningWaitlist || (dogs.length > 1 && !waitlistDogId) || dogs.length === 0}
                    onClick={handleJoinWaitlist}
                  >
                    {joiningWaitlist ? "Joining…" : "Join waitlist"}
                  </Button>
                  {waitlistMessage && <p className="text-sm">{waitlistMessage}</p>}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={() => setStepIndex((i) => i + 1)}
            disabled={
              (isBoarding && !available) ||
              (isDateBased && !available) ||
              (isForestWalk && !selectedSlotId) ||
              (isDogWalking && (!selectedRunId || !pickupAddress || !postcode))
            }
          >
            Continue
          </Button>
        </div>
      )}

      {step === "dogs" && (
        <div className="space-y-5">
          {dogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You need a dog profile before booking.{" "}
              <Link href="/portal/dogs/new" className="font-medium text-primary hover:underline">
                Add a dog
              </Link>
            </p>
          ) : (
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
          )}

          {trialWarning && trialWarning.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold">
                {trialWarning.join(", ")}{" "}
                {trialWarning.length === 1 ? "requires" : "require"} a mandatory Meet &amp; Greet
                evaluation before {trialWarning.length === 1 ? "it" : "they"} can book any service.{" "}
                <Link href="/book/meet-greet" className="font-medium underline">
                  Book a Meet &amp; Greet
                </Link>
                .
              </p>
            </div>
          )}

          {vaccinationWarning && vaccinationWarning.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-medium">Vaccinations needed before booking:</p>
                <ul className="mt-1 list-disc pl-5">
                  {vaccinationWarning.map((entry) => (
                    <li key={entry.dogName}>
                      {entry.dogName}: {entry.missingTypes.join(", ")}
                    </li>
                  ))}
                </ul>
                <Link href="/portal/vaccinations" className="mt-2 inline-block font-medium underline">
                  Add vaccination records
                </Link>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
            <Button
              onClick={goToReviewFromDogs}
              disabled={selectedDogIds.length === 0 || checkingVaccinations || checkingTrial}
            >
              {checkingVaccinations || checkingTrial ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "addons" && (
        <div className="space-y-5">
          {addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No add-ons available for this service.</p>
          ) : (
            <ul className="space-y-2">
              {addons.map((addon) => (
                <li key={addon.id}>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={selectedAddonIds.includes(addon.id)}
                        onChange={() => toggleAddon(addon.id)}
                      />
                      <span>
                        {addon.name}
                        {addon.description && (
                          <span className="block text-muted-foreground">{addon.description}</span>
                        )}
                      </span>
                    </span>
                    <span className="font-medium">{formatPence(addon.pricePence)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStepIndex((i) => i - 1)}>
              Back
            </Button>
            <Button onClick={() => setStepIndex((i) => i + 1)}>Continue</Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <div className="flex justify-between">
              <span>
                {service.name} × {dogCount} dog{dogCount > 1 ? "s" : ""}
                {isBoarding ? ` × ${nights} night${nights === 1 ? "" : "s"}` : ""}
              </span>
              <span>{formatPence(basePreviewPence)}</span>
            </div>
            {selectedAddonIds.map((id) => {
              const addon = addons.find((a) => a.id === id)
              if (!addon) return null
              return (
                <div key={id} className="flex justify-between text-muted-foreground">
                  <span>{addon.name}</span>
                  <span>{formatPence(addon.pricePence)}</span>
                </div>
              )
            })}
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <span>Total</span>
              <span>{formatPence(totalPreviewPence)}</span>
            </div>
            {service.paymentTiming === "DEPOSIT_THEN_BALANCE" && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Deposit due now ({depositPercent}%)</span>
                  <span>{formatPence(depositPreviewPence)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Balance</span>
                  <span>{formatPence(totalPreviewPence - depositPreviewPence)}</span>
                </div>
              </>
            )}
            {service.paymentTiming === "FULL_UPFRONT" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Due now</span>
                <span>{formatPence(totalPreviewPence)}</span>
              </div>
            )}
            {service.paymentTiming === "INVOICE_AFTER" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Due now</span>
                <span>{formatPence(0)}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Prices shown are our standard rates — peak-season pricing, if it applies to these dates,
            is calculated when you confirm and shown on your booking confirmation.
          </p>

          <p className="text-xs text-muted-foreground">
            {service.paymentTiming === "FULL_UPFRONT"
              ? "Confirming reserves your booking — you'll then pay securely with Stripe to lock it in."
              : service.paymentTiming === "DEPOSIT_THEN_BALANCE"
                ? "Confirming reserves your booking — you'll then pay your deposit securely with Stripe, and we'll collect the balance before check-in."
                : "Nothing to pay now — your booking is confirmed straight away and we'll email you an invoice after the service."}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStepIndex((i) => i - 1)} disabled={submitting}>
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Confirming…" : "Confirm booking"}
            </Button>
          </div>
          {submitError && requiresTrialVisit ? (
            <div className="flex items-start gap-3 rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-sm font-bold">
                {submitError}{" "}
                <Link href="/book/meet-greet" className="font-medium underline">
                  Book a Meet & Greet
                </Link>
                .
              </p>
            </div>
          ) : (
            submitError && <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>
      )}
    </div>
  )
}
