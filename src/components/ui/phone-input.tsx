import * as React from "react"

import { Input } from "@/components/ui/input"

function sanitizePhone(value: string): string {
  return value.replace(/[^0-9+]/g, "")
}

function PhoneInput({
  onChange,
  onPaste,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      inputMode="tel"
      {...props}
      type="tel"
      onChange={(event) => {
        const sanitized = sanitizePhone(event.target.value)
        if (sanitized !== event.target.value) {
          event.target.value = sanitized
        }
        onChange?.(event)
      }}
      onPaste={(event) => {
        event.preventDefault()
        const pasted = sanitizePhone(event.clipboardData.getData("text"))
        const input = event.currentTarget
        const start = input.selectionStart ?? input.value.length
        const end = input.selectionEnd ?? input.value.length
        input.value = input.value.slice(0, start) + pasted + input.value.slice(end)
        input.setSelectionRange(start + pasted.length, start + pasted.length)
        onPaste?.(event)
      }}
    />
  )
}

export { PhoneInput }
