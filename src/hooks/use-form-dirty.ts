"use client"

import { useCallback, useEffect, useRef, useState } from "react"

function snapshotForm(form: HTMLFormElement): string {
  return Array.from(new FormData(form).entries())
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&")
}

// Tracks whether a form's fields differ from what they were on mount, so a
// Save button can stay disabled until something actually changes. Works with
// plain uncontrolled inputs (defaultValue) — no need to lift every field into
// controlled state. Call `markClean()` after a successful submit (and after
// any imperative `form.reset()`) so the button greys out again post-save.
export function useFormDirty() {
  const formRef = useRef<HTMLFormElement>(null)
  const initialSnapshot = useRef("")
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (formRef.current) initialSnapshot.current = snapshotForm(formRef.current)
  }, [])

  const handleChange = useCallback(() => {
    if (formRef.current) setDirty(snapshotForm(formRef.current) !== initialSnapshot.current)
  }, [])

  const markClean = useCallback(() => {
    if (formRef.current) initialSnapshot.current = snapshotForm(formRef.current)
    setDirty(false)
  }, [])

  return { formRef, dirty, handleChange, markClean }
}
