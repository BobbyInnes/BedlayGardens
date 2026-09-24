"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button"
import {
  createTag,
  deleteTag,
  setTagActive,
  updateTag,
  type TagActionState,
  type TagKind,
} from "@/app/admin/tags/actions"

type ManagedTag = {
  id: string
  name: string
  description: string | null
  active: boolean
  usageCount: number
}

function TagRow({ kind, tag, itemNoun }: { kind: TagKind; tag: ManagedTag; itemNoun: string }) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(tag.name)
  const [description, setDescription] = React.useState(tag.description ?? "")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function run(action: () => Promise<TagActionState>) {
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
    if (await run(() => updateTag(kind, tag.id, name, description))) setEditing(false)
  }

  return (
    <li className="space-y-1 py-3 first:pt-0 last:pb-0">
      {editing ? (
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-56"
            aria-label={`Name for tag ${tag.name}`}
          />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="What this tag means (optional)"
            aria-label={`Description for tag ${tag.name}`}
          />
          <div className="flex items-center gap-2">
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
                setName(tag.name)
                setDescription(tag.description ?? "")
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-0.5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-blue-700 underline dark:text-blue-300">
                {tag.name}
              </span>
              {!tag.active && <Badge variant="outline">Inactive</Badge>}
              <span className="text-muted-foreground">
                used on {tag.usageCount} {itemNoun}
                {tag.usageCount === 1 ? "" : "s"}
              </span>
            </div>
            {tag.description && (
              <p className="whitespace-pre-line text-muted-foreground">{tag.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setTagActive(kind, tag.id, !tag.active))}
            >
              {tag.active ? "Deactivate" : "Activate"}
            </Button>
            <ConfirmDeleteButton
              label="Delete"
              title={`Delete the tag "${tag.name}"?`}
              description={`This removes it from the tag list and from the ${tag.usageCount} ${itemNoun}${tag.usageCount === 1 ? "" : "s"} it is currently applied to. To just stop it being offered for new use, deactivate it instead. This cannot be undone.`}
              onConfirm={async () => {
                const result = await deleteTag(kind, tag.id)
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

export function TagListManager({
  kind,
  itemNoun,
  tags,
}: {
  kind: TagKind
  itemNoun: string
  tags: ManagedTag[]
}) {
  const [newName, setNewName] = React.useState("")
  const [newDescription, setNewDescription] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const result = await createTag(kind, newName, newDescription)
      if (result.status === "error") {
        setError(result.message ?? "Something went wrong.")
      } else {
        setNewName("")
        setNewDescription("")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={40}
          placeholder={`New ${itemNoun} tag`}
          className="w-64"
          aria-label={`New ${itemNoun} tag name`}
        />
        <Textarea
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="What this tag means (optional)"
          aria-label={`New ${itemNoun} tag description`}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending || !newName.trim()}>
            {pending ? "Adding…" : "Add tag"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>

      {tags.length > 0 ? (
        <ul className="divide-y-2 divide-gray-400 dark:divide-gray-500">
          {tags.map((tag) => (
            <TagRow key={tag.id} kind={kind} tag={tag} itemNoun={itemNoun} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No {itemNoun} tags yet.</p>
      )}
    </div>
  )
}
