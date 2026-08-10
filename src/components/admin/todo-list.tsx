"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createToDoTask, deleteToDoTask, toggleToDoTask } from "@/app/admin/todo/actions"

type Task = {
  id: string
  text: string
  completed: boolean
  assignedTo: { id: string; name: string } | null
}

export function ToDoList({
  tasks,
  staff,
}: {
  tasks: Task[]
  staff: { id: string; name: string }[]
}) {
  const [prevTasks, setPrevTasks] = useState(tasks)
  const [items, setItems] = useState(tasks)
  const [, startTransition] = useTransition()

  // The page passes a new `tasks` array after add/toggle/delete revalidate,
  // or when the assignee filter or day changes — resync local (optimistic)
  // state to it. Adjusting state during render (rather than in an effect)
  // avoids an extra render pass; see https://react.dev/learn/you-might-not-need-an-effect.
  if (tasks !== prevTasks) {
    setPrevTasks(tasks)
    setItems(tasks)
  }

  function handleToggle(id: string, completed: boolean) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)))
    startTransition(async () => {
      await toggleToDoTask(id, completed)
    })
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id))
    startTransition(async () => {
      await deleteToDoTask(id)
    })
  }

  return (
    <div className="space-y-3">
      <form
        action={async (formData) => {
          await createToDoTask(formData)
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Input name="text" placeholder="Add a task…" required className="max-w-xs" />
        <select
          name="assignedToId"
          defaultValue=""
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Unassigned</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          Add
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No to-do tasks.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((task) => (
            <li key={task.id} className="flex items-center gap-3 p-3 text-sm">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(e) => handleToggle(task.id, e.target.checked)}
                className="size-4 shrink-0 rounded border-input"
                aria-label={`Mark "${task.text}" ${task.completed ? "not done" : "done"}`}
              />
              <span className={`flex-1 ${task.completed ? "text-muted-foreground line-through" : ""}`}>
                {task.text}
              </span>
              {task.assignedTo && (
                <span className="shrink-0 text-xs text-muted-foreground">{task.assignedTo.name}</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(task.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete "${task.text}"`}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
