"use client"

import { useActionState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteDog, type DeleteDogState } from "@/app/portal/dogs/actions"

const initialState: DeleteDogState = { status: "idle" }

export function DeleteDogButton({ dogId, dogName }: { dogId: string; dogName: string }) {
  const [state, formAction, pending] = useActionState(deleteDog.bind(null, dogId), initialState)

  return (
    <form action={formAction}>
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${dogName}`}
        disabled={pending}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      {state.status === "error" && (
        <p className="mt-1 max-w-48 text-xs text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
