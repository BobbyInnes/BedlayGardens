"use server"

import ExcelJS from "exceljs"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { setOptOut } from "@/lib/notification-preferences"
import { planCustomerImport, type CellValue, type PlanRow } from "@/lib/customer-import"

const MAX_FILE_BYTES = 15_000_000

export type ImportPreview =
  | { ok: true; rows: PlanRow[]; unusedColumns: string[] }
  | { ok: false; message: string }

export type ImportResult =
  | {
      ok: true
      createdCustomers: number
      createdDogs: number
      skipped: number
      failures: { rowNumber: number; email: string; message: string }[]
    }
  | { ok: false; message: string }

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

// A cell's value as ExcelJS hands it back — plain scalars, or a rich-text /
// formula-result / hyperlink wrapper object that needs unwrapping.
function cellValue(raw: ExcelJS.CellValue): CellValue {
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date) return raw
  if (typeof raw === "object") {
    if ("richText" in raw) return raw.richText.map((t) => t.text).join("")
    if ("result" in raw) return cellValue(raw.result as ExcelJS.CellValue)
    if ("text" in raw) return String(raw.text)
    return null
  }
  return raw
}

async function readWorkbookRows(file: File): Promise<CellValue[][] | null> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return null

  const rows: CellValue[][] = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: CellValue[] = []
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cellValue(cell.value))
    })
    rows[rowNumber - 1] = cells
  })
  return rows
}

// Both actions build the plan from the uploaded file on the server — the
// confirm step never trusts a plan sent back from the browser.
async function buildPlan(formData: FormData) {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, message: "Choose an Excel (.xlsx) file first." }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false as const, message: "That file is too large to import in one go." }
  }

  let rows: CellValue[][] | null
  try {
    rows = await readWorkbookRows(file)
  } catch {
    return { ok: false as const, message: "Couldn't read that file — is it a valid .xlsx?" }
  }
  if (!rows) return { ok: false as const, message: "That file has no sheets." }

  const [users, sources] = await Promise.all([
    prisma.user.findMany({ select: { email: true } }),
    prisma.referralSource.findMany({ select: { id: true, name: true } }),
  ])
  return planCustomerImport(rows, {
    existingEmails: new Set(users.map((u) => u.email.toLowerCase())),
    referralIdByName: new Map(sources.map((s) => [s.name.toLowerCase(), s.id])),
  })
}

// Read-only: parses and checks the file, writes nothing.
export async function previewCustomerImport(formData: FormData): Promise<ImportPreview> {
  await requireAdmin()
  const plan = await buildPlan(formData)
  return plan.ok ? { ok: true, rows: plan.rows, unusedColumns: plan.unusedColumns } : plan
}

export async function runCustomerImport(formData: FormData): Promise<ImportResult> {
  const session = await requireAdmin()
  const plan = await buildPlan(formData)
  if (!plan.ok) return plan

  const toCreate = plan.rows.filter((r) => r.status === "new")
  let createdCustomers = 0
  let createdDogs = 0
  const failures: { rowNumber: number; email: string; message: string }[] = []

  for (const row of toCreate) {
    try {
      // One nested create per customer, so a customer and their dogs are
      // written together or not at all. No password is set — imported
      // customers sign in via "forgot password" / magic link — and no welcome
      // email is sent.
      const user = await prisma.user.create({
        data: {
          salutation: row.salutation,
          forename: row.forename,
          surname: row.surname,
          email: row.email,
          role: "CUSTOMER",
          phone: row.phone,
          workPhone: row.workPhone,
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2,
          addressCity: row.addressCity,
          addressPostcode: row.addressPostcode,
          adminNotes: row.adminNotes,
          referralSourceId: row.referralSourceId,
          vetPracticeName: row.vet?.practiceName ?? null,
          vetName: row.vet?.contactName ?? null,
          vetPhone: row.vet?.phone ?? null,
          vetAddressLine1: row.vet?.addressLine1 ?? null,
          vetAddressLine2: row.vet?.addressLine2 ?? null,
          vetCity: row.vet?.city ?? null,
          vetPostcode: row.vet?.postcode ?? null,
          dogs: {
            create: row.dogs.map((d) => ({
              name: d.name,
              breed: d.breed,
              neutered: d.neutered,
              sex: d.sex,
              color: d.color,
              weightKg: d.weightKg,
              size: d.size,
              allergies: d.allergies,
              medicalHistorySummary: d.medicalHistorySummary,
              feedingNotes: d.feedingNotes,
              vaccinationNotes: d.vaccinationNotes,
              vaccinationRecords: {
                create: d.vaccinations.map((v) => ({
                  type: v.type,
                  dateGiven: new Date(v.dateGiven),
                  expiryDate: new Date(v.expiryDate),
                })),
              },
              ...(d.dob ? { dob: new Date(d.dob) } : {}),
            })),
          },
        },
      })
      createdCustomers++
      createdDogs += row.dogs.length

      // Carry over an explicit "no marketing emails" choice from the sheet.
      if (row.marketingOptOut) await setOptOut(user.id, "ABANDONED_BOOKING_REMINDER", true)

      await logAudit({
        actorId: session.user.id,
        action: "CREATE_CUSTOMER",
        entity: "User",
        entityId: user.id,
        meta: `${row.forename} ${row.surname} <${row.email}> — imported from spreadsheet (row ${row.rowNumbers.join(", ")}, ${row.dogs.length} dog${row.dogs.length === 1 ? "" : "s"})`,
      })
    } catch (error) {
      const code = (error as { code?: string })?.code
      failures.push({
        rowNumber: row.rowNumbers[0],
        email: row.email,
        message:
          code === "P2002"
            ? "An account with this email already exists."
            : "Couldn't be saved — no changes were made for this customer.",
      })
      if (code !== "P2002") console.error("[customer-import] row failed", row.rowNumbers, error)
    }
  }

  await logAudit({
    actorId: session.user.id,
    action: "IMPORT_CUSTOMERS",
    entity: "User",
    entityId: "bulk-import",
    meta: `Spreadsheet import: ${createdCustomers} customer(s) and ${createdDogs} dog(s) created, ${plan.rows.length - toCreate.length} row(s) skipped, ${failures.length} failed`,
  })

  revalidatePath("/admin/customers", "layout")
  revalidatePath("/admin/dogs")
  revalidatePath("/admin/referral-sources")

  return {
    ok: true,
    createdCustomers,
    createdDogs,
    skipped: plan.rows.length - toCreate.length,
    failures,
  }
}
