import type { Metadata } from "next"
import { DogForm } from "@/components/portal/dog-form"
import { createDog } from "@/app/portal/dogs/actions"

export const metadata: Metadata = {
  title: "Add a Dog",
}

export default function NewDogPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add a dog</h1>
      <DogForm action={createDog} submitLabel="Add dog" />
    </div>
  )
}
