"use client"

import * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import {
  createReferralSource,
  deleteReferralSource,
  moveReferralSource,
  renameReferralSource,
  setReferralSourceActive,
  type ReferralSourceActionState,
} from "@/app/admin/referral-sources/actions"

type ManagedSource = {
  id: string
  name: string
  active: boolean
  usageCount: number
}

function SourceRow({
  source,
  isFirst,
  isLast,
}: {
  source: ManagedSource
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(source.name)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function run(action: () => Promise<ReferralSourceActionState>) {
    setPending(true)
    setError(null)
    try {
      const result = await action()
      if (result.status === "error") {
        setError(result.message ?? "Something went wrong.")
        return false
      }
      return true
    } catch {
      setError("Something went wrong. Please try again.")
      return false
    } finally {
      setPending(false)
    }
  }

  async function handleSave() {
    if (await run(() => renameReferralSource(source.id, name))) setEditing(false)
  }

  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-64"
            aria-label={`Name for option ${source.name}`}
          />
          <Button type="button" size="sm" disabled={pending} onClick={handleSave}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setEditing(false)
              setName(source.name)
              setError(null)
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">{source.name}</span>
            {!source.active && <Badge variant="outline">Inactive</Badge>}
            <span className="text-muted-foreground">
              chosen by {source.usageCount} customer{source.usageCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending || isFirst}
              onClick={() => run(() => moveReferralSource(source.id, "up"))}
              aria-label={`Move ${source.name} up`}
            >
              <ArrowUp className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending || isLast}
              onClick={() => run(() => moveReferralSource(source.id, "down"))}
              aria-label={`Move ${source.name} down`}
            >
              <ArrowDown className="size-4" aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setReferralSourceActive(source.id, !source.active))}
            >
              {source.active ? "Deactivate" : "Activate"}
            </Button>
            <ConfirmDeleteButton
              label="Delete"
              title={`Delete "${source.name}"?`}
              description={
                source.usageCount > 0
                  ? `${source.usageCount} customer${source.usageCount === 1 ? " has" : "s have"} chosen this option, so it can't be deleted. Deactivate it instead to stop it being offered.`
                  : "This removes the option from the list. This cannot be undone."
              }
              onConfirm={async () => {
                const result = await deleteReferralSource(source.id)
                if (result.status === "error") return { error: result.message }
              }}
            />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  )
}

export function ReferralSourceManager({ sources }: { sources: ManagedSource[] }) {
  const [newName, setNewName] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await createReferralSource(newName)
      if (result.status === "error") {
        setError(result.message ?? "Something went wrong.")
      } else {
        setNewName("")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-3">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={60}
          placeholder="New option"
          className="w-64"
          aria-label="New option name"
        />
        <Button type="submit" size="sm" disabled={pending || !newName.trim()}>
          {pending ? "Adding…" : "Add option"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {sources.length > 0 ? (
        <ul className="divide-y-2 divide-gray-400 dark:divide-gray-500">
          {sources.map((source, i) => (
            <SourceRow
              key={source.id}
              source={source}
              isFirst={i === 0}
              isLast={i === sources.length - 1}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No options yet.</p>
      )}
    </div>
  )
}
