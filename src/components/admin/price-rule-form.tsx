"use client"

import * as React from "react"
import { useActionState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createPriceRule, type AdminActionState } from "@/app/admin/services/actions"

const initialState: AdminActionState = { status: "idle" }

export function PriceRuleForm({ serviceId }: { serviceId: string }) {
  const [state, formAction, pending] = useActionState(createPriceRule.bind(null, serviceId), initialState)
  const [priceType, setPriceType] = React.useState<"multiplier" | "override">("multiplier")
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "idle") formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="max-w-2xl space-y-3 rounded-md border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pr-label" className="text-xs">
            Label
          </Label>
          <Input id="pr-label" name="label" placeholder="Christmas peak" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-minNights" className="text-xs">
            Minimum nights (optional, boarding only)
          </Label>
          <Input id="pr-minNights" name="minNights" type="number" min={1} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-startDate" className="text-xs">
            Start date
          </Label>
          <Input id="pr-startDate" name="startDate" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pr-endDate" className="text-xs">
            End date
          </Label>
          <Input id="pr-endDate" name="endDate" type="date" required />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="pr-priceType" className="text-xs">
            Price change
          </Label>
          <Select name="priceType" value={priceType} onValueChange={(v) => setPriceType(v as typeof priceType)}>
            <SelectTrigger id="pr-priceType" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiplier">Multiplier (e.g. +25%)</SelectItem>
              <SelectItem value="override">Fixed override price</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {priceType === "multiplier" ? (
          <div className="space-y-1">
            <Label htmlFor="pr-multiplier" className="text-xs">
              Multiplier (1.25 = +25%)
            </Label>
            <Input id="pr-multiplier" name="multiplier" type="number" step="0.01" min={0.01} className="w-32" />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="pr-override" className="text-xs">
              Override price (pence)
            </Label>
            <Input
              id="pr-override"
              name="overridePricePence"
              type="number"
              min={0}
              className="w-32"
            />
          </div>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add rule"}
        </Button>
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
    </form>
  )
}
