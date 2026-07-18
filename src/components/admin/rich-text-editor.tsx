"use client"

import { useRef } from "react"
import { Bold, Underline, Eraser } from "lucide-react"
import { cn } from "@/lib/utils"

const COLORS = [
  { label: "Default", value: "#111827" },
  { label: "Red", value: "#dc2626" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#9333ea" },
]

export function RichTextEditor({
  name,
  defaultValue,
  placeholder,
  className,
}: {
  name: string
  defaultValue?: string | null
  placeholder?: string
  className?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const hiddenRef = useRef<HTMLInputElement>(null)

  function sync() {
    if (editorRef.current && hiddenRef.current) {
      hiddenRef.current.value = editorRef.current.innerHTML
    }
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    sync()
  }

  // Colour needs styleWithCSS enabled so the browser emits
  // <span style="color:…"> (allowed by the sanitizer) instead of a <font>
  // tag (stripped on save). Toggle it off again afterwards so bold/underline
  // keep producing <b>/<u> rather than font-weight spans, which the sanitizer
  // would also strip.
  function applyColor(value: string) {
    editorRef.current?.focus()
    document.execCommand("styleWithCSS", false, "true")
    document.execCommand("foreColor", false, value)
    document.execCommand("styleWithCSS", false, "false")
    sync()
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-input p-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Bold"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("underline")}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Underline"
        >
          <Underline className="size-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-border" />
        {COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColor(color.value)}
            className="size-5 rounded-full border border-border"
            style={{ backgroundColor: color.value }}
            aria-label={`Text colour: ${color.label}`}
            title={color.label}
          />
        ))}
        <div className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("removeFormat")}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear formatting"
          title="Clear formatting"
        >
          <Eraser className="size-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        className="min-h-24 px-2.5 py-2 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        dangerouslySetInnerHTML={{ __html: defaultValue ?? "" }}
      />
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue ?? ""} />
    </div>
  )
}
