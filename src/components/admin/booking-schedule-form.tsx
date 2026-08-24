"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateBookingSchedule } from "@/app/admin/bookings/actions"

export function BookingScheduleForm({
  bookingId,
  scheduledTime,
  assignedStaffId,
  staffOptions,
}: {
  bookingId: string
  scheduledTime: string | null
  assignedStaffId: string | null
  staffOptions: { id: string; name: string }[]
}) {
  const [time, setTime] = React.useState(scheduledTime ?? "")
  const [staffId, setStaffId] = React.useState(assignedStaffId ?? "NONE")
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ text: string; error: boolean } | null>(null)

  const unchanged = time === (scheduledTime ?? "") && staffId === (assignedStaffId ?? "NONE")

  async function handleSubmit() {
    setPending(true)
    setMessage(null)
    const result = await updateBookingSchedule(bookingId, time, staffId === "NONE" ? null : staffId)
    setMessage({ text: result.message ?? "", error: result.status === "error" })
    setPending(false)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="scheduledTime">Time</Label>
        <Input
          id="scheduledTime"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-32"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="assignedStaffId">Assigned to</Label>
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger id="assignedStaffId" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Unassigned</SelectItem>
            {staffOptions.map((staff) => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" variant="outline" disabled={pending || unchanged} onClick={handleSubmit}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {message && (
        <p className={message.error ? "text-sm text-destructive" : "text-sm text-primary"}>
          {message.text}
        </p>
      )}
    </div>
  )
}
