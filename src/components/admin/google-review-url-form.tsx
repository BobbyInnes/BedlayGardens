"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateGoogleReviewUrl, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function GoogleReviewUrlForm({ url }: { url: string }) {
  const [state, formAction, pending] = useActionState(updateGoogleReviewUrl, initialState)

  return (
    <form action={formAction} className="flex max-w-xl flex-wrap items-end gap-3">
      <div className="grow space-y-2">
        <Label htmlFor="google_business_review_url">Google Business review link</Label>
        <Input
          id="google_business_review_url"
          name="google_business_review_url"
          type="url"
          placeholder="https://g.page/r/.../review"
          defaultValue={url}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.message && (
        <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {state.message}
        </p>
      )}
    </form>
  )
}
