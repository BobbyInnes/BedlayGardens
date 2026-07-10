"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveExtractedVaccinations } from "@/app/portal/vaccinations/upload/actions"

type FileStatus = {
  id: string
  fileName: string
  status: "uploading" | "done" | "error"
  errorMessage?: string
}

type PendingEntry = {
  id: string
  fileKey: string | null
  fileName: string
  type: string
  dateGiven: string
  expiryDate: string
  vetPractice: string | null
}

export function CertificateUploader({ dogId }: { dogId: string }) {
  const router = useRouter()
  const [fileStatuses, setFileStatuses] = React.useState<FileStatus[]>([])
  const [entries, setEntries] = React.useState<PendingEntry[]>([])
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    const statusId = crypto.randomUUID()
    setFileStatuses((prev) => [...prev, { id: statusId, fileName: file.name, status: "uploading" }])

    try {
      const formData = new FormData()
      formData.append("dogId", dogId)
      formData.append("file", file)

      const response = await fetch("/api/portal/vaccinations/extract", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? "Upload failed")
      }

      const data: {
        fileKey: string
        fileName: string
        vaccines: { type: string | null; dateGiven: string | null; expiryDate: string | null; vetPractice: string | null }[]
      } = await response.json()

      setFileStatuses((prev) =>
        prev.map((f) => (f.id === statusId ? { ...f, status: "done" } : f))
      )

      const newEntries: PendingEntry[] =
        data.vaccines.length > 0
          ? data.vaccines.map((vaccine) => ({
              id: crypto.randomUUID(),
              fileKey: data.fileKey,
              fileName: data.fileName,
              type: vaccine.type ?? "",
              dateGiven: vaccine.dateGiven ?? "",
              expiryDate: vaccine.expiryDate ?? "",
              vetPractice: vaccine.vetPractice,
            }))
          : [
              {
                id: crypto.randomUUID(),
                fileKey: data.fileKey,
                fileName: data.fileName,
                type: "",
                dateGiven: "",
                expiryDate: "",
                vetPractice: null,
              },
            ]

      setEntries((prev) => [...prev, ...newEntries])
    } catch (error) {
      setFileStatuses((prev) =>
        prev.map((f) =>
          f.id === statusId
            ? { ...f, status: "error", errorMessage: error instanceof Error ? error.message : "Failed" }
            : f
        )
      )
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    for (const file of Array.from(fileList)) {
      void processFile(file)
    }
  }

  function updateEntry(id: string, changes: Partial<PendingEntry>) {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  async function handleSaveAll() {
    setSaving(true)
    setSaveError(null)
    try {
      const result = await saveExtractedVaccinations({
        dogId,
        entries: entries.map((entry) => ({
          type: entry.type,
          dateGiven: entry.dateGiven,
          expiryDate: entry.expiryDate,
          fileKey: entry.fileKey,
        })),
      })
      if (result.status === "error") {
        setSaveError(result.message)
        return
      }
      router.push("/portal/vaccinations")
    } finally {
      setSaving(false)
    }
  }

  const allDone = fileStatuses.length > 0 && fileStatuses.every((f) => f.status !== "uploading")
  const canSave =
    entries.length > 0 && entries.every((e) => e.type && e.dateGiven && e.expiryDate) && !saving

  return (
    <div className="space-y-8">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          handleFiles(event.dataTransfer.files)
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 text-center hover:bg-muted/50"
      >
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">Drag and drop certificates here, or click to choose files</p>
        <p className="text-xs text-muted-foreground">JPEG, PNG, HEIC, or PDF — multiple files supported</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {fileStatuses.length > 0 && (
        <ul className="space-y-2">
          {fileStatuses.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              {f.status === "uploading" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {f.status === "done" && <CheckCircle2 className="size-4 text-primary" />}
              {f.status === "error" && <XCircle className="size-4 text-destructive" />}
              <span>{f.fileName}</span>
              {f.status === "error" && (
                <span className="text-destructive">— {f.errorMessage}, fill in manually below</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {allDone && entries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Review before saving</h2>
          <p className="text-sm text-muted-foreground">
            Confirm or correct each field. Nothing is saved until you press Save.
          </p>
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{entry.fileName}</p>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Vaccine type</Label>
                    <Input
                      value={entry.type}
                      onChange={(e) => updateEntry(entry.id, { type: e.target.value })}
                      placeholder="e.g. DHPP"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date given</Label>
                    <Input
                      type="date"
                      value={entry.dateGiven}
                      onChange={(e) => updateEntry(entry.id, { dateGiven: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expiry date</Label>
                    <Input
                      type="date"
                      value={entry.expiryDate}
                      onChange={(e) => updateEntry(entry.id, { expiryDate: e.target.value })}
                    />
                  </div>
                </div>
                {entry.vetPractice && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Vet practice on certificate: {entry.vetPractice}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSaveAll} disabled={!canSave}>
            {saving ? "Saving…" : "Save all vaccination records"}
          </Button>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </div>
      )}
    </div>
  )
}
