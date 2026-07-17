"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import { updateAboutBanner, type AdminActionState } from "@/app/admin/content/actions"

const initialState: AdminActionState = { status: "idle" }

export function AboutBannerForm({ banner }: { banner: string }) {
  const [state, formAction, pending] = useActionState(updateAboutBanner, initialState)

  return (
    <form action={formAction} className="max-w-2xl space-y-3">
      <RichTextEditor
        name="about_banner"
        defaultValue={banner}
        placeholder="About page banner text — the first paragraph is shown as the headline…"
      />
      <p className="text-xs text-muted-foreground">
        Shown in a highlighted band at the top of the About Us page. Clear the text and save to
        hide the banner.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save banner"}
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
