"use client"

import { useActionState } from "react"
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
import type { Service } from "@/generated/prisma/client"
import type { AdminActionState } from "@/app/admin/services/actions"

const initialState: AdminActionState = { status: "idle" }

export function ServiceForm({
  service,
  action,
  submitLabel,
}: {
  service?: Service
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={service?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={service?.slug} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={service?.description} rows={3} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pricingModel">Pricing model</Label>
          <Select name="pricingModel" defaultValue={service?.pricingModel ?? "PER_NIGHT"}>
            <SelectTrigger id="pricingModel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PER_NIGHT">Per night</SelectItem>
              <SelectItem value="PER_DAY">Per day</SelectItem>
              <SelectItem value="PER_SESSION">Per session</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="basePricePence">Base price (pence)</Label>
          <Input
            id="basePricePence"
            name="basePricePence"
            type="number"
            min={0}
            defaultValue={service?.basePricePence}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={service?.sortOrder ?? 0} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>

      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
