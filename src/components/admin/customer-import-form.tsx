"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  previewCustomerImport,
  runCustomerImport,
  type ImportPreview,
  type ImportResult,
} from "@/app/admin/import/actions"
import type { PlanDog, PlanRow, PlanStatus } from "@/lib/customer-import"

const STATUS_LABEL: Record<PlanStatus, string> = {
  new: "Will be created",
  exists: "Already a customer — skipped",
  error: "Problem — skipped",
}

function StatusBadge({ status }: { status: PlanStatus }) {
  return (
    <Badge variant={status === "new" ? "secondary" : status === "error" ? "destructive" : "outline"}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}

function addressText(r: PlanRow) {
  return [r.addressLine1, r.addressLine2, r.addressCity, r.addressPostcode].filter(Boolean).join(", ")
}

function vetText(r: PlanRow) {
  if (!r.vet) return ""
  const address = [r.vet.addressLine1, r.vet.addressLine2, r.vet.city, r.vet.postcode].filter(Boolean).join(", ")
  return [r.vet.practiceName, r.vet.contactName && `Contact: ${r.vet.contactName}`, r.vet.phone, address]
    .filter(Boolean)
    .join(" · ")
}

function dogText(d: PlanDog) {
  const dob = d.dob ? new Date(d.dob).toLocaleDateString("en-GB") : null
  return [d.sex, dob && `born ${dob}`, d.weightKg && `${d.weightKg}kg`, d.neutered && "neutered"]
    .filter(Boolean)
    .join(" · ")
}

export function CustomerImportForm() {
  const [fileName, setFileName] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ImportPreview | null>(null)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const [busy, setBusy] = React.useState<"preview" | "import" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  function resetOutput() {
    setPreview(null)
    setResult(null)
    setError(null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    resetOutput()
    setFile(f)
    setFileName(f?.name ?? "")
  }

  async function handlePreview() {
    if (!file) return
    setBusy("preview")
    resetOutput()
    try {
      const formData = new FormData()
      formData.set("file", file)
      setPreview(await previewCustomerImport(formData))
    } catch {
      setError("Something went wrong reading the file. Please try again.")
    } finally {
      setBusy(null)
    }
  }

  async function handleImport() {
    if (!file) return
    setBusy("import")
    setError(null)
    try {
      const formData = new FormData()
      formData.set("file", file)
      setResult(await runCustomerImport(formData))
      setPreview(null)
    } catch {
      setError("Something went wrong during the import. Check the customer list before trying again.")
    } finally {
      setBusy(null)
    }
  }

  const rows = preview?.ok ? preview.rows : []
  const toCreate = rows.filter((r) => r.status === "new")
  const dogCount = toCreate.reduce((n, r) => n + r.dogs.length, 0)

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-100 p-4">
        <div className="space-y-2">
          <Label htmlFor="xlsxFile">Excel file (.xlsx)</Label>
          <Input
            id="xlsxFile"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            className="max-w-md"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handlePreview} disabled={!file || busy !== null}>
            {busy === "preview" ? "Checking…" : "Preview import"}
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          Previewing only checks the file — nothing is saved until you press the Import button below the preview.
        </p>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {preview && !preview.ok && <p className="text-sm text-destructive">{preview.message}</p>}
      {result && !result.ok && <p className="text-sm text-destructive">{result.message}</p>}

      {result?.ok && (
        <section className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-semibold">
            Imported {result.createdCustomers} customer{result.createdCustomers === 1 ? "" : "s"} and{" "}
            {result.createdDogs} dog{result.createdDogs === 1 ? "" : "s"}.
          </p>
          <p className="text-muted-foreground">{result.skipped} row(s) were skipped.</p>
          {result.failures.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-destructive">{result.failures.length} failed:</p>
              <ul className="list-disc pl-5">
                {result.failures.map((f) => (
                  <li key={f.rowNumber}>
                    Row {f.rowNumber} ({f.email}): {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-muted-foreground">
            Imported customers have no password — they sign in with &ldquo;Forgot password&rdquo;. No emails were sent.
          </p>
        </section>
      )}

      {preview?.ok && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{toCreate.length}</span> customer
              {toCreate.length === 1 ? "" : "s"} and <span className="font-semibold">{dogCount}</span> dog
              {dogCount === 1 ? "" : "s"} will be created · {rows.length - toCreate.length} of {rows.length} rows
              skipped
            </p>
            <Button type="button" onClick={handleImport} disabled={toCreate.length === 0 || busy !== null}>
              {busy === "import"
                ? "Importing…"
                : `Import ${toCreate.length} customer${toCreate.length === 1 ? "" : "s"} and ${dogCount} dog${dogCount === 1 ? "" : "s"}`}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-100 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Dogs</th>
                  <th className="px-3 py-2">Vet</th>
                  <th className="px-3 py-2">How heard</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 align-top">
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td className="px-3 py-2">{r.rowNumbers.join(", ")}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {[r.salutation, r.forename, r.surname].filter(Boolean).join(" ")}
                      </div>
                      <div className="text-muted-foreground">{r.email}</div>
                      <div className="text-muted-foreground">
                        {[r.phone && `Mobile ${r.phone}`, r.workPhone && `Work ${r.workPhone}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {r.marketingOptOut && <div className="text-xs text-muted-foreground">No marketing emails</div>}
                    </td>
                    <td className="px-3 py-2">{addressText(r)}</td>
                    <td className="px-3 py-2">
                      {r.dogs.length > 0 ? (
                        r.dogs.map((d) => (
                          <div key={d.name}>
                            {d.name} <span className="text-muted-foreground">({d.breed})</span>
                            {dogText(d) && <div className="text-xs text-muted-foreground">{dogText(d)}</div>}
                          </div>
                        ))
                      ) : (
                        <span className="text-muted-foreground">No dog</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{vetText(r)}</td>
                    <td className="px-3 py-2">
                      {r.heardRaw ? (
                        <>
                          <div>{r.referralSourceName}</div>
                          <div className="text-xs text-muted-foreground">&ldquo;{r.heardRaw}&rdquo;</div>
                        </>
                      ) : null}
                    </td>
                    <td className="space-y-1 px-3 py-2">
                      <StatusBadge status={r.status} />
                      {r.problems.map((p) => (
                        <div key={p} className="text-xs text-destructive">
                          {p}
                        </div>
                      ))}
                      {r.warnings.map((w) => (
                        <div key={w} className="text-xs text-amber-700">
                          {w}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.unusedColumns.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                {preview.unusedColumns.length} column(s) in the file are not imported
              </summary>
              <p className="mt-2">{preview.unusedColumns.join(", ")}</p>
            </details>
          )}
        </section>
      )}
    </div>
  )
}
