"use client"

import { useRef, useState } from "react"
import { Bold, Underline, Eraser, ImagePlus } from "lucide-react"
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Snapshot used only for dangerouslySetInnerHTML. Ordinary typing never
  // touches this (sync() below only updates the hidden input) — the editor's
  // own DOM stays the source of truth while typing, which is what avoids the
  // classic contentEditable-cursor-jumps-to-start bug. But inserting an image
  // mutates the DOM directly, outside React's knowledge, and *any* later
  // re-render (e.g. setUploading(false) once the next upload settles) would
  // reapply this stale __html and silently erase that image. So the instant
  // an image is inserted, this snapshot is updated to match — batched in the
  // same tick as the state change that triggers the re-render — so if React
  // does reapply innerHTML, it reapplies the current content, not the past.
  const [html, setHtml] = useState(defaultValue ?? "")

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

  // Opening the file picker steals focus from the editor, which loses its
  // text selection — so the insertion point is captured here (onMouseDown
  // keeps focus in the editor right up to this click) and restored once the
  // upload finishes.
  function openImagePicker() {
    const selection = window.getSelection()
    savedRangeRef.current =
      selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)
        ? selection.getRangeAt(0).cloneRange()
        : null
    fileInputRef.current?.click()
  }

  // Uploads via a plain API route rather than a Server Action, so the upload
  // itself doesn't add another source of re-renders on top of the local
  // uploading/error state changes already handled above.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow picking the same file again later
    if (!file) return

    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const res = await fetch("/api/admin/content/upload-image", {
        method: "POST",
        body: formData,
      })
      const result = await res.json()

      if (!res.ok) {
        setUploadError(result.error ?? "Upload failed.")
        return
      }

      const editor = editorRef.current
      if (!editor) return
      editor.focus()

      const img = document.createElement("img")
      img.src = result.url
      img.alt = ""

      const selection = window.getSelection()
      const range = savedRangeRef.current
      if (selection && range && editor.contains(range.commonAncestorContainer)) {
        selection.removeAllRanges()
        selection.addRange(range)
        range.deleteContents()
        range.insertNode(img)
        range.setStartAfter(img)
        range.setEndAfter(img)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        editor.appendChild(img)
      }

      sync()
      setHtml(editor.innerHTML)
    } catch {
      setUploadError("Upload failed.")
    } finally {
      setUploading(false)
    }
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
        <div className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openImagePicker}
          disabled={uploading}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Insert image"
          title="Insert image"
        >
          <ImagePlus className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
        {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
      </div>
      {uploadError && <p className="border-b border-input px-2.5 py-1.5 text-xs text-destructive">{uploadError}</p>}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        className="min-h-24 px-2.5 py-2 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_img]:inline [&_img]:max-w-full [&_img]:rounded-md [&_img]:align-middle"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue ?? ""} />
    </div>
  )
}
