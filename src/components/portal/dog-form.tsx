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
import type { Dog } from "@/generated/prisma/client"
import type { DogFormState } from "@/app/portal/dogs/actions"
import { DOG_BREEDS, OTHER_BREED_VALUE } from "@/lib/dog-breeds"

const initialState: DogFormState = { status: "idle" }

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return date.toISOString().slice(0, 10)
}

export function DogForm({
  dog,
  action,
  submitLabel,
}: {
  dog?: Dog
  action: (state: DogFormState, formData: FormData) => Promise<DogFormState>
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  const today = new Date()
  const minDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())

  const knownBreed = dog?.breed && (DOG_BREEDS as readonly string[]).includes(dog.breed)
  const [breedChoice, setBreedChoice] = useState<string>(
    dog?.breed ? (knownBreed ? dog.breed : OTHER_BREED_VALUE) : ""
  )

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={dog?.name} required />
          {state.fieldErrors?.name && (
            <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="breed">Breed</Label>
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
              defaultValue={!knownBreed ? (dog?.breed ?? "") : ""}
              required
              className="mt-2"
            />
          )}
          {state.fieldErrors?.breed && (
            <p className="text-sm text-destructive">{state.fieldErrors.breed}</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input
            id="dob"
            name="dob"
            type="date"
            min={toDateInputValue(minDob)}
            max={toDateInputValue(today)}
            defaultValue={toDateInputValue(dog?.dob)}
          />
          {state.fieldErrors?.dob && (
            <p className="text-sm text-destructive">{state.fieldErrors.dob}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sex">Sex</Label>
          <Select name="sex" defaultValue={dog?.sex ?? ""}>
            <SelectTrigger id="sex" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightKg">Weight (kg)</Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            step="0.1"
            min="0"
            max="200"
            defaultValue={dog?.weightKg ?? ""}
          />
          {state.fieldErrors?.weightKg && (
            <p className="text-sm text-destructive">{state.fieldErrors.weightKg}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="size">Pet size</Label>
          <Select name="size" defaultValue={dog?.size ?? ""}>
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
      </div>

      <div className="flex items-center gap-2">
        <input
          id="neutered"
          name="neutered"
          type="checkbox"
          defaultChecked={dog?.neutered}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="neutered" className="font-normal">
          Neutered / spayed
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="photo">Photo</Label>
        {dog?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${dog.photoUrl}`}
            alt={dog.name}
            className="mb-2 size-24 rounded-lg object-cover"
          />
        )}
        <Input id="photo" name="photo" type="file" accept="image/*" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="vetName">Vet name</Label>
          <Input id="vetName" name="vetName" defaultValue={dog?.vetName ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vetPhone">Vet phone</Label>
          <PhoneInput id="vetPhone" name="vetPhone" defaultValue={dog?.vetPhone ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContact">Emergency contact</Label>
        <Input
          id="emergencyContact"
          name="emergencyContact"
          defaultValue={dog?.emergencyContact ?? ""}
          placeholder="Name and phone number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedingNotes">Feeding instructions</Label>
        <Textarea id="feedingNotes" name="feedingNotes" defaultValue={dog?.feedingNotes ?? ""} rows={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="medicationNotes">Medication</Label>
        <Textarea
          id="medicationNotes"
          name="medicationNotes"
          defaultValue={dog?.medicationNotes ?? ""}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="behaviourNotes">Behavioural notes</Label>
        <Textarea
          id="behaviourNotes"
          name="behaviourNotes"
          defaultValue={dog?.behaviourNotes ?? ""}
          rows={3}
        />
      </div>

      <Button type="submit" disabled={pending}>
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
