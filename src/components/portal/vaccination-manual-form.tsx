"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createVaccinationManual,
  type VaccinationFormState,
} from "@/app/portal/vaccinations/actions"
import { FIXED_VACCINES } from "@/app/portal/vaccinations/vaccine-types"

const initialState: VaccinationFormState = { status: "idle" }

const fixedLabels: Record<(typeof FIXED_VACCINES)[number]["id"], string> = {
  DHPP: "DHPP",
  Leptospirosis: "Leptospirosis",
  KennelCough: "Kennel Cough",
}

// Mirrors the server's own from-date + validity-years calculation (see
// addYears in actions.ts) so the expiry shown here matches what actually
// gets saved.
function addYears(dateStr: string, years: number): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ""
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

export function VaccinationManualForm({
  dogId,
  mode,
}: {
  dogId: string
  mode: "mandatory" | "other"
}) {
  const [state, formAction, pending] = useActionState(createVaccinationManual, initialState)
  const [checked, setChecked] = useState<Record<string, boolean>>({
    DHPP: true,
    Leptospirosis: true,
    KennelCough: true,
  })
  // Text/date inputs are kept controlled — not because we need the values in
  // JS, but because React 19 resets any *uncontrolled* field once a form
  // action call completes, even on a validation error. A controlled field's
  // value is re-applied from this state on that same re-render, so an error
  // never wipes out what someone already typed.
  const [values, setValues] = useState<Record<string, string>>({})
  const certificateInputRef = useRef<HTMLInputElement>(null)
  const chosenCertificateRef = useRef<File | null>(null)

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  // React resets uncontrolled form fields (including file inputs) once the
  // action call completes, even when it returns a validation error rather
  // than redirecting. Restore the file the visitor already chose so an error
  // on the date fields doesn't force them to re-pick the certificate too.
  useEffect(() => {
    if (state.status !== "error") return
    const file = chosenCertificateRef.current
    const input = certificateInputRef.current
    if (!file || !input || input.files?.length) return
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
  }, [state])

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      <input type="hidden" name="dogId" value={dogId} />

      {mode === "mandatory" ? (
        <>
          <div className="space-y-2">
            <Label>Vaccines</Label>
            <p className="text-sm text-muted-foreground">
              Tick every vaccine you&apos;re recording — you can add them all in one go.
            </p>
          </div>

          <div className="space-y-4">
            {FIXED_VACCINES.map((vaccine) => (
              <VaccineRow
                key={vaccine.id}
                id={vaccine.id}
                label={fixedLabels[vaccine.id]}
                checked={checked[vaccine.id]}
                onToggle={() => toggle(vaccine.id)}
                fieldErrors={state.fieldErrors}
                values={values}
                setValue={setValue}
                autoExpiryYears={vaccine.maxValidityYears}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <input type="hidden" name="enabled_Other" value="on" />
          <div className="space-y-2">
            <Label htmlFor="otherType">Vaccine name</Label>
            <Input
              id="otherType"
              name="otherType"
              placeholder="Enter vaccine type"
              value={values.otherType ?? ""}
              onChange={(e) => setValue("otherType", e.target.value)}
            />
            {state.fieldErrors?.otherType && (
              <p className="text-sm text-destructive">{state.fieldErrors.otherType}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <DateFields id="Other" fieldErrors={state.fieldErrors} values={values} setValue={setValue} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="certificate">Related vaccine certificate (mandatory)</Label>
        <Input
          id="certificate"
          name="certificate"
          type="file"
          accept="image/*,.pdf"
          required
          ref={certificateInputRef}
          onChange={(e) => {
            chosenCertificateRef.current = e.target.files?.[0] ?? null
          }}
        />
        {state.fieldErrors?.certificate && (
          <p className="text-sm text-destructive">{state.fieldErrors.certificate}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add vaccination record"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`/portal/vaccinations?dogId=${dogId}`}>Back</Link>
        </Button>
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}

function VaccineRow({
  id,
  label,
  checked,
  onToggle,
  fieldErrors,
  values,
  setValue,
  autoExpiryYears,
}: {
  id: string
  label: string
  checked: boolean
  onToggle: () => void
  fieldErrors?: Record<string, string>
  values: Record<string, string>
  setValue: (name: string, value: string) => void
  autoExpiryYears: number
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-36 shrink-0 items-center gap-2">
          <Checkbox
            id={`enabled_${id}`}
            name={`enabled_${id}`}
            checked={checked}
            onCheckedChange={onToggle}
          />
          <Label htmlFor={`enabled_${id}`} className="font-medium">
            {label}
          </Label>
        </div>
        {checked && (
          <DateFields
            id={id}
            fieldErrors={fieldErrors}
            dateWidth="w-36"
            values={values}
            setValue={setValue}
            autoExpiryYears={autoExpiryYears}
          />
        )}
      </div>
    </div>
  )
}

function DateFields({
  id,
  fieldErrors,
  dateWidth = "w-40",
  values,
  setValue,
  autoExpiryYears,
}: {
  id: string
  fieldErrors?: Record<string, string>
  dateWidth?: string
  values: Record<string, string>
  setValue: (name: string, value: string) => void
  autoExpiryYears?: number
}) {
  const dateGivenName = `dateGiven_${id}`
  const expiryDateName = `expiryDate_${id}`
  const fromDateValue = values[dateGivenName] ?? ""
  const computedExpiry = autoExpiryYears ? addYears(fromDateValue, autoExpiryYears) : ""
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={dateGivenName}>From Date</Label>
        <Input
          id={dateGivenName}
          name={dateGivenName}
          type="date"
          className={dateWidth}
          value={fromDateValue}
          onChange={(e) => setValue(dateGivenName, e.target.value)}
        />
        {fieldErrors?.[dateGivenName] && (
          <p className="text-sm text-destructive">{fieldErrors[dateGivenName]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={expiryDateName}>Expiry date</Label>
        {autoExpiryYears ? (
          // Calculated from the from date server-side — not user-editable,
          // and not submitted as its own field (the server derives it).
          <Input
            id={expiryDateName}
            type="date"
            className={dateWidth}
            value={computedExpiry}
            disabled
          />
        ) : (
          <Input
            id={expiryDateName}
            name={expiryDateName}
            type="date"
            className={dateWidth}
            value={values[expiryDateName] ?? ""}
            onChange={(e) => setValue(expiryDateName, e.target.value)}
          />
        )}
        {fieldErrors?.[expiryDateName] && (
          <p className="text-sm text-destructive">{fieldErrors[expiryDateName]}</p>
        )}
      </div>
    </>
  )
}
