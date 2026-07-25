"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { NAV_LINKS, navSettingKey } from "@/lib/nav-links"
import { updateNavVisibility, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function NavVisibilityForm({ settings }: { settings: Record<string, string> }) {
  const [state, formAction, pending] = useActionState(updateNavVisibility, initialState)

  return (
    <form action={formAction} className="max-w-md space-y-3">
      {NAV_LINKS.map((link) => (
        <div key={link.key} className="flex items-center gap-2">
          <input
            id={`nav-${link.key}`}
            name={link.key}
            type="checkbox"
            defaultChecked={settings[navSettingKey(link.key)] !== "false"}
            className="size-4 rounded border-input"
          />
          <Label htmlFor={`nav-${link.key}`} className="font-normal">
            {link.label}
          </Label>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.message && (
          <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}
