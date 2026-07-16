"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/admin/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { User } from "@/generated/prisma/client"
import type { AdminActionState } from "@/app/admin/staff/actions"

const initialState: AdminActionState = { status: "idle" }

export function StaffForm({
  staff,
  action,
  submitLabel,
  showPassword = false,
  viewerIsSuperAdmin = false,
  superAdminSlotAvailable = true,
}: {
  staff?: User
  action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState>
  submitLabel: string
  showPassword?: boolean
  /** Whether the logged-in admin viewing this form is themselves a super admin (or bootstrapping the first one). */
  viewerIsSuperAdmin?: boolean
  /** Whether a super admin slot is free — either this account already holds one, or fewer than the max exist. */
  superAdminSlotAvailable?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [role, setRole] = useState(staff?.role ?? "STAFF")

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={staff?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={staff?.email} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={staff?.phone ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobTitle">Job title</Label>
        <Input
          id="jobTitle"
          name="jobTitle"
          placeholder="e.g. Kennel Manager"
          defaultValue={staff?.jobTitle ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          Shown under their name in the &ldquo;Meet the team&rdquo; section on the About page.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="photo">Photo</Label>
        {staff?.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staff.photoUrl}
            alt={staff.name}
            className="mb-2 size-24 rounded-lg object-cover"
          />
        )}
        <Input id="photo" name="photo" type="file" accept="image/*" />
        <p className="text-xs text-muted-foreground">
          Also shown on the About page, so use a clear, friendly photo.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <RichTextEditor
          name="bio"
          defaultValue={staff?.bio}
          placeholder="A couple of sentences about them for visitors to read"
        />
        <p className="text-xs text-muted-foreground">
          Shown under their name and job title in &ldquo;Meet the team&rdquo; on the About page.
          Use the toolbar to bold, underline, or colour parts of the text.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select name="role" value={role} onValueChange={(value) => setRole(value as "STAFF" | "ADMIN")}>
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STAFF">Staff</SelectItem>
            {(viewerIsSuperAdmin || staff?.role === "ADMIN") && (
              <SelectItem value="ADMIN">Admin</SelectItem>
            )}
          </SelectContent>
        </Select>
        {!viewerIsSuperAdmin && (
          <p className="text-xs text-muted-foreground">
            Only a super admin can create or promote admin accounts.
          </p>
        )}
      </div>
      {role === "ADMIN" && viewerIsSuperAdmin && (
        <label
          className={`flex items-start gap-3 rounded-lg border border-input p-3 text-sm ${
            !superAdminSlotAvailable && !staff?.isSuperAdmin ? "opacity-50" : ""
          }`}
        >
          <input
            type="checkbox"
            name="isSuperAdmin"
            defaultChecked={staff?.isSuperAdmin}
            disabled={!superAdminSlotAvailable && !staff?.isSuperAdmin}
            className="mt-0.5 size-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Super admin</span>
            <span className="block text-muted-foreground">
              Can add, edit, deactivate, and promote other admin accounts. Admins can&rsquo;t
              touch super admin accounts. Limited to 2 at a time.
              {!superAdminSlotAvailable && !staff?.isSuperAdmin && (
                <span className="block font-medium text-destructive">
                  Both super admin slots are already in use.
                </span>
              )}
            </span>
          </span>
        </label>
      )}
      {showPassword && (
        <div className="space-y-2">
          <Label htmlFor="password">Temporary password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
