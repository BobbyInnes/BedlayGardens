"use client"

import { useActionState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteDog, type DeleteDogState } from "@/app/portal/dogs/actions"

const initialState: DeleteDogState = { status: "idle" }

export function DeleteDogButton({
  dogId,
  dogName,
  label,
}: {
  dogId: string
  dogName: string
  /** Renders a labeled destructive button instead of the default icon-only button. */
  label?: string
}) {
  const [state, formAction, pending] = useActionState(deleteDog.bind(null, dogId), initialState)

  return (
    <form action={formAction}>
      {label ? (
        <Button type="submit" variant="destructive" size="sm" disabled={pending}>
          <Trash2 className="size-4" />
          {pending ? "Deleting…" : label}
        </Button>
      ) : (
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${dogName}`}
          disabled={pending}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      )}
      {state.status === "error" && (
        <p className="mt-1 max-w-48 text-xs text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
