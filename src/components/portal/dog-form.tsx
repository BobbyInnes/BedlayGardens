"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Dog, DogMedication, DogFeedingItem } from "@/generated/prisma/client"
import type { DogFormState } from "@/app/portal/dogs/actions"
import { DOG_BREEDS, OTHER_BREED_VALUE } from "@/lib/dog-breeds"
import { compressImage } from "@/lib/compress-image"

const initialState: DogFormState = { status: "idle" }

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

type MedicationMode = "checkboxes" | "time"

type MedicationRow = {
  key: string
  name: string
  amount: string
  mode: MedicationMode
  am: boolean
  pm: boolean
  specificTime: string
}

let medicationRowSeq = 0
function newMedicationRow(): MedicationRow {
  medicationRowSeq += 1
  return {
    key: `new-${medicationRowSeq}`,
    name: "",
    amount: "",
    mode: "checkboxes",
    am: false,
    pm: false,
    specificTime: "",
  }
}

function medicationRowsFromDog(medications: DogMedication[] | undefined): MedicationRow[] {
  if (!medications || medications.length === 0) return [newMedicationRow()]
  return medications.map((med) => ({
    key: med.id,
    name: med.name,
    amount: med.amount ?? "",
    mode: med.specificTime ? "time" : "checkboxes",
    am: med.am,
    pm: med.pm,
    specificTime: med.specificTime ?? "",
  }))
}

type FeedingRow = {
  key: string
  item: string
  amount: string
  mode: MedicationMode
  am: boolean
  pm: boolean
  specificTime: string
}

let feedingRowSeq = 0
function newFeedingRow(): FeedingRow {
  feedingRowSeq += 1
  return {
    key: `new-${feedingRowSeq}`,
    item: "",
    amount: "",
    mode: "checkboxes",
    am: false,
    pm: false,
    specificTime: "",
  }
}

function feedingRowsFromDog(feedingItems: DogFeedingItem[] | undefined): FeedingRow[] {
  if (!feedingItems || feedingItems.length === 0) return [newFeedingRow()]
  return feedingItems.map((f) => ({
    key: f.id,
    item: f.item,
    amount: f.amount ?? "",
    mode: f.specificTime ? "time" : "checkboxes",
    am: f.am,
    pm: f.pm,
    specificTime: f.specificTime ?? "",
  }))
}

export function DogForm({
  dog,
  action,
  submitLabel,
}: {
  dog?: Dog & { medications?: DogMedication[]; feedingItems?: DogFeedingItem[] }
  action: (state: DogFormState, formData: FormData) => Promise<DogFormState>
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  // On error, the action echoes back whatever was submitted so a failed
  // submission refills the form instead of blanking it — remount (via
  // `key` below) so these `defaultValue`s take effect.
  const values = state.status === "error" ? state.values : undefined

  // Medical history rows live in ordinary component state (not tied to the
  // `key`-remount trick above) so a failed submission of the other fields
  // doesn't wipe out rows the user has already entered.
  const [medicationRows, setMedicationRows] = useState<MedicationRow[]>(() =>
    medicationRowsFromDog(dog?.medications)
  )

  function updateMedicationRow(index: number, patch: Partial<MedicationRow>) {
    setMedicationRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addMedicationRow() {
    setMedicationRows((rows) => [...rows, newMedicationRow()])
  }

  function removeMedicationRow(index: number) {
    setMedicationRows((rows) => rows.filter((_, i) => i !== index))
  }

  // Feeding rows — same rationale as medication rows above.
  const [feedingRows, setFeedingRows] = useState<FeedingRow[]>(() =>
    feedingRowsFromDog(dog?.feedingItems)
  )

  function updateFeedingRow(index: number, patch: Partial<FeedingRow>) {
    setFeedingRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addFeedingRow() {
    setFeedingRows((rows) => [...rows, newFeedingRow()])
  }

  function removeFeedingRow(index: number) {
    setFeedingRows((rows) => rows.filter((_, i) => i !== index))
  }

  const today = new Date()
  const minDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())

  const knownBreed = dog?.breed && (DOG_BREEDS as readonly string[]).includes(dog.breed)
  const [breedChoice, setBreedChoice] = useState<string>(
    dog?.breed ? (knownBreed ? dog.breed : OTHER_BREED_VALUE) : ""
  )

  const [compressingPhoto, setCompressingPhoto] = useState(false)

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setCompressingPhoto(true)
    try {
      const compressed = await compressImage(file)
      if (compressed !== file) {
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(compressed)
        input.files = dataTransfer.files
      }
    } finally {
      setCompressingPhoto(false)
    }
  }

  return (
    <form
      key={values ? JSON.stringify(values) : "initial"}
      action={formAction}
      className="max-w-2xl space-y-6"
    >
      <div className="space-y-3 rounded-lg bg-muted p-4">
        <Label>Dog details</Label>
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs font-normal">
                Name
              </Label>
              <Input id="name" name="name" defaultValue={values ? values.name : dog?.name} required />
              {state.fieldErrors?.name && (
                <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="breed" className="text-xs font-normal">
                Breed
              </Label>
              <Select
                value={breedChoice}
                onValueChange={setBreedChoice}
                name={breedChoice === OTHER_BREED_VALUE ? undefined : "breed"}
              >
                <SelectTrigger id="breed" className="w-full">
                  <SelectValue placeholder="Select a breed" />
                </SelectTrigger>
                <SelectContent>
                  {DOG_BREEDS.map((breed) => (
                    <SelectItem key={breed} value={breed}>
                      {breed}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_BREED_VALUE}>Other</SelectItem>
                </SelectContent>
              </Select>
              {breedChoice === OTHER_BREED_VALUE && (
                <Input
                  name="breed"
                  placeholder="Enter breed"
                  defaultValue={values ? values.breed : !knownBreed ? (dog?.breed ?? "") : ""}
                  required
                  className="mt-2"
                />
              )}
              {state.fieldErrors?.breed && (
                <p className="text-sm text-destructive">{state.fieldErrors.breed}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="dob" className="text-xs font-normal">
                Date of birth
              </Label>
              <Input
                id="dob"
                name="dob"
                type="date"
                min={toDateInputValue(minDob)}
                max={toDateInputValue(today)}
                defaultValue={values ? values.dob : toDateInputValue(dog?.dob)}
              />
              {state.fieldErrors?.dob && (
                <p className="text-sm text-destructive">{state.fieldErrors.dob}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="sex" className="text-xs font-normal">
                Sex
              </Label>
              <Select name="sex" defaultValue={values ? values.sex : (dog?.sex ?? "")}>
                <SelectTrigger id="sex" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="weightKg" className="text-xs font-normal">
                Weight (kg)
              </Label>
              <Input
                id="weightKg"
                name="weightKg"
                type="number"
                step="0.1"
                min="0"
                max="200"
                defaultValue={values ? values.weightKg : (dog?.weightKg ?? "")}
              />
              {state.fieldErrors?.weightKg && (
                <p className="text-sm text-destructive">{state.fieldErrors.weightKg}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="size" className="text-xs font-normal">
                Pet size
              </Label>
              <Select name="size" defaultValue={values ? values.size : (dog?.size ?? "")}>
                <SelectTrigger id="size" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINIATURE">Miniature</SelectItem>
                  <SelectItem value="SMALL">Small</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LARGE">Large</SelectItem>
                  <SelectItem value="GIANT">Giant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="microchipNumber" className="text-xs font-normal">
                Microchip number
              </Label>
              <Input
                id="microchipNumber"
                name="microchipNumber"
                defaultValue={values ? values.microchipNumber : (dog?.microchipNumber ?? "")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="color" className="text-xs font-normal">
                Color
              </Label>
              <Input
                id="color"
                name="color"
                defaultValue={values ? values.color : (dog?.color ?? "")}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="neutered"
              name="neutered"
              type="checkbox"
              defaultChecked={values ? values.neutered : dog?.neutered}
              className="size-4 rounded border-input"
            />
            <Label htmlFor="neutered" className="text-xs font-normal">
              Neutered / spayed
            </Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="photo" className="text-xs font-normal">
              Photo
            </Label>
            {dog?.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${dog.photoUrl}`}
                alt={dog.name}
                className="mb-2 size-24 rounded-lg object-cover"
              />
            )}
            <Input id="photo" name="photo" type="file" accept="image/*" onChange={handlePhotoChange} />
            {compressingPhoto && (
              <p className="text-xs text-muted-foreground">Compressing photo…</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        <Label>Emergency contact</Label>
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="emergencyContactName" className="text-xs font-normal">
                Name
              </Label>
              <Input
                id="emergencyContactName"
                name="emergencyContactName"
                defaultValue={
                  values ? values.emergencyContactName : (dog?.emergencyContactName ?? "")
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="emergencyContactPhone" className="text-xs font-normal">
                Phone number
              </Label>
              <PhoneInput
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                defaultValue={
                  values ? values.emergencyContactPhone : (dog?.emergencyContactPhone ?? "")
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-normal">Address</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="emergencyContactAddressLine1"
                name="emergencyContactAddressLine1"
                placeholder="Address line 1"
                defaultValue={
                  values
                    ? values.emergencyContactAddressLine1
                    : (dog?.emergencyContactAddressLine1 ?? "")
                }
              />
              <Input
                id="emergencyContactAddressLine2"
                name="emergencyContactAddressLine2"
                placeholder="Address line 2"
                defaultValue={
                  values
                    ? values.emergencyContactAddressLine2
                    : (dog?.emergencyContactAddressLine2 ?? "")
                }
              />
              <Input
                id="emergencyContactCity"
                name="emergencyContactCity"
                placeholder="Town / city"
                defaultValue={
                  values ? values.emergencyContactCity : (dog?.emergencyContactCity ?? "")
                }
              />
              <Input
                id="emergencyContactPostcode"
                name="emergencyContactPostcode"
                placeholder="Postcode"
                defaultValue={
                  values ? values.emergencyContactPostcode : (dog?.emergencyContactPostcode ?? "")
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        <Label>Vet practice</Label>
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="vetPracticeName" className="text-xs font-normal">
                Vet practice name
              </Label>
              <Input
                id="vetPracticeName"
                name="vetPracticeName"
                defaultValue={values ? values.vetPracticeName : (dog?.vetPracticeName ?? "")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vetEmail" className="text-xs font-normal">
                Vet practice email
              </Label>
              <Input
                id="vetEmail"
                name="vetEmail"
                type="email"
                defaultValue={values ? values.vetEmail : (dog?.vetEmail ?? "")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vetName" className="text-xs font-normal">
                Vet name
              </Label>
              <Input
                id="vetName"
                name="vetName"
                defaultValue={values ? values.vetName : (dog?.vetName ?? "")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vetPhone" className="text-xs font-normal">
                Vet phone
              </Label>
              <PhoneInput
                id="vetPhone"
                name="vetPhone"
                defaultValue={values ? values.vetPhone : (dog?.vetPhone ?? "")}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-normal">Address</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                id="vetAddressLine1"
                name="vetAddressLine1"
                placeholder="Address line 1"
                defaultValue={values ? values.vetAddressLine1 : (dog?.vetAddressLine1 ?? "")}
              />
              <Input
                id="vetAddressLine2"
                name="vetAddressLine2"
                placeholder="Address line 2"
                defaultValue={values ? values.vetAddressLine2 : (dog?.vetAddressLine2 ?? "")}
              />
              <Input
                id="vetCity"
                name="vetCity"
                placeholder="Town / city"
                defaultValue={values ? values.vetCity : (dog?.vetCity ?? "")}
              />
              <Input
                id="vetPostcode"
                name="vetPostcode"
                placeholder="Postcode"
                defaultValue={values ? values.vetPostcode : (dog?.vetPostcode ?? "")}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        <input type="hidden" name="med-count" value={medicationRows.length} />
        <Label>Medical history</Label>
        <div className="space-y-3">
          {medicationRows.map((row, index) => (
            <div key={row.key} className="space-y-3 rounded-md border border-border bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor={`med-name-${index}`} className="text-xs font-normal">
                    Medication name
                  </Label>
                  <Input
                    id={`med-name-${index}`}
                    name={`med-name-${index}`}
                    value={row.name}
                    onChange={(e) => updateMedicationRow(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`med-amount-${index}`} className="text-xs font-normal">
                    Amount
                  </Label>
                  <Input
                    id={`med-amount-${index}`}
                    name={`med-amount-${index}`}
                    placeholder="e.g. 5mg"
                    value={row.amount}
                    onChange={(e) => updateMedicationRow(index, { amount: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMedicationRow(index)}
                    disabled={medicationRows.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id={`med-am-${index}`}
                    name={`med-am-${index}`}
                    type="checkbox"
                    checked={row.am}
                    onChange={(e) => updateMedicationRow(index, { am: e.target.checked })}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor={`med-am-${index}`} className="font-normal">
                    AM
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`med-pm-${index}`}
                    name={`med-pm-${index}`}
                    type="checkbox"
                    checked={row.pm}
                    onChange={(e) => updateMedicationRow(index, { pm: e.target.checked })}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor={`med-pm-${index}`} className="font-normal">
                    PM
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`med-time-toggle-${index}`}
                    type="checkbox"
                    checked={row.mode === "time"}
                    onChange={(e) =>
                      updateMedicationRow(index, { mode: e.target.checked ? "time" : "checkboxes" })
                    }
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor={`med-time-toggle-${index}`} className="font-normal">
                    Specific time
                  </Label>
                  {row.mode === "time" && (
                    <Input
                      id={`med-time-${index}`}
                      name={`med-time-${index}`}
                      type="time"
                      className="w-32"
                      value={row.specificTime}
                      onChange={(e) => updateMedicationRow(index, { specificTime: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addMedicationRow}>
          + Add medication
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergies">Allergies</Label>
        <Textarea
          id="allergies"
          name="allergies"
          defaultValue={values ? values.allergies : (dog?.allergies ?? "")}
          rows={2}
        />
      </div>

      <div className="space-y-3 rounded-lg bg-muted p-4">
        <input type="hidden" name="feed-count" value={feedingRows.length} />
        <Label>Feeding instructions</Label>
        <div className="space-y-3">
          {feedingRows.map((row, index) => (
            <div key={row.key} className="space-y-3 rounded-md border border-border bg-background p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <Label htmlFor={`feed-item-${index}`} className="text-xs font-normal">
                    Food item
                  </Label>
                  <Input
                    id={`feed-item-${index}`}
                    name={`feed-item-${index}`}
                    value={row.item}
                    onChange={(e) => updateFeedingRow(index, { item: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`feed-amount-${index}`} className="text-xs font-normal">
                    Amount
                  </Label>
                  <Input
                    id={`feed-amount-${index}`}
                    name={`feed-amount-${index}`}
                    placeholder="e.g. 200g"
                    value={row.amount}
                    onChange={(e) => updateFeedingRow(index, { amount: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFeedingRow(index)}
                    disabled={feedingRows.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id={`feed-am-${index}`}
                    name={`feed-am-${index}`}
                    type="checkbox"
                    checked={row.am}
                    onChange={(e) => updateFeedingRow(index, { am: e.target.checked })}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor={`feed-am-${index}`} className="font-normal">
                    AM
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`feed-pm-${index}`}
                    name={`feed-pm-${index}`}
                    type="checkbox"
                    checked={row.pm}
                    onChange={(e) => updateFeedingRow(index, { pm: e.target.checked })}
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor={`feed-pm-${index}`} className="font-normal">
                    PM
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={`feed-time-toggle-${index}`}
                    type="checkbox"
                    checked={row.mode === "time"}
                    onChange={(e) =>
                      updateFeedingRow(index, { mode: e.target.checked ? "time" : "checkboxes" })
                    }
                    className="size-4 rounded border-input"
                  />
                  <Label htmlFor={`feed-time-toggle-${index}`} className="font-normal">
                    Specific time
                  </Label>
                  {row.mode === "time" && (
                    <Input
                      id={`feed-time-${index}`}
                      name={`feed-time-${index}`}
                      type="time"
                      className="w-32"
                      value={row.specificTime}
                      onChange={(e) => updateFeedingRow(index, { specificTime: e.target.value })}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addFeedingRow}>
          + Add food item
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="behaviourNotes">Behavioural notes</Label>
        <Textarea
          id="behaviourNotes"
          name="behaviourNotes"
          defaultValue={values ? values.behaviourNotes : (dog?.behaviourNotes ?? "")}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={pending || compressingPhoto}>
        {pending ? "Saving…" : submitLabel}
      </Button>

      {state.status === "error" && state.message && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
