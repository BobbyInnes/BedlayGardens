"use client"

import { useActionState, useRef, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadLogo, resetLogo, type AdminActionState } from "@/app/admin/media/actions"

const initialState: AdminActionState = { status: "idle" }

export function SiteLogoForm({ logoUrl }: { logoUrl: string | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [resetting, startReset] = useTransition()
  const [state, formAction, pending] = useActionState(async (prev: AdminActionState, formData: FormData) => {
    const result = await uploadLogo(prev, formData)
    if (result.status === "idle") formRef.current?.reset()
    return result
  }, initialState)

  return (
    <div className="space-y-4">
      <div className="inline-block rounded-lg border border-border bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl ?? "/images/logo.png"} alt="Current site logo" className="h-12 w-auto max-w-xs object-contain" />
      </div>
      <p className="text-sm text-muted-foreground">
        {logoUrl ? "Using your uploaded logo." : "Using the default logo."}
      </p>

      <form ref={formRef} action={formAction} className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="site-logo-file">{logoUrl ? "Replace logo" : "Upload logo"}</Label>
            <Input id="site-logo-file" name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Upload"}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="outline"
              disabled={resetting}
              onClick={() => startReset(async () => void (await resetLogo()))}
            >
              {resetting ? "Resetting…" : "Reset to default"}
            </Button>
          )}
        </div>
        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      </form>
    </div>
  )
}
