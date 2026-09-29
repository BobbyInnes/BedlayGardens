// One-off admin utility: imports customers + dogs from a spreadsheet in the
// "upload test1.xlsx" layout (rows 2-4 = section / card / field name, data
// from row 5, column A = email) into the TEST database, then writes each
// created customer's and dog's number back onto the end of that row.
//
// Uses the same parsing/mapping as the admin "Import customers" page
// (src/lib/customer-import.ts) and creates records the same way as
// src/app/admin/import/actions.ts.
//
// Dry run (default — writes nothing, prints what would happen):
//   npx tsx --env-file=.env.test scripts/import-customers-from-xlsx.ts imports/U_M_1_1_100.xlsx
// Apply:
//   npx tsx --env-file=.env.test scripts/import-customers-from-xlsx.ts imports/U_M_1_1_100.xlsx --apply
//
// Refuses to run unless DATABASE_URL resolves to the known Neon test branch
// host — see memory/test-db-and-e2e.md.
import fs from "node:fs"
import path from "node:path"
import ExcelJS from "exceljs"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../src/generated/prisma/client"
import { planCustomerImport, type CellValue } from "../src/lib/customer-import"
import { formatCustomerNumber, formatDogNumber } from "../src/lib/customer-dog-numbers"

const TEST_DB_HOST = "ep-falling-water-abdgailo-pooler.eu-west-2.aws.neon.tech"

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

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.includes(TEST_DB_HOST)) {
    console.error(
      `Refusing to run: DATABASE_URL doesn't look like the test branch (expected host "${TEST_DB_HOST}"). ` +
        `Run this with "npx tsx --env-file=.env.test ...".`
    )
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const file = args.find((a) => !a.startsWith("--"))
  if (!file) {
    console.error("Usage: import-customers-from-xlsx.ts <file.xlsx> [--apply]")
    process.exit(1)
  }
  const filePath = path.resolve(file)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error("The file has no sheets.")

  const rows: CellValue[][] = []
  let lastHeaderCol = 0
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: CellValue[] = []
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cellValue(cell.value))
    })
    rows[rowNumber - 1] = cells
    if (rowNumber >= 2 && rowNumber <= 4) {
      cells.forEach((c, idx) => {
        if (c !== null && c !== "") lastHeaderCol = Math.max(lastHeaderCol, idx + 1)
      })
    }
  })
  const customerCol = lastHeaderCol + 1
  const dogCol = lastHeaderCol + 2

  const adapter = new PrismaNeon({ connectionString: url })
  const prisma = new PrismaClient({ adapter })

  const [users, sources, admin] = await Promise.all([
    prisma.user.findMany({ select: { email: true } }),
    prisma.referralSource.findMany({ select: { id: true, name: true } }),
    prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }),
  ])
  const plan = planCustomerImport(rows, {
    existingEmails: new Set(users.map((u) => u.email.toLowerCase())),
    referralIdByName: new Map(sources.map((s) => [s.name.toLowerCase(), s.id])),
  })
  if (!plan.ok) throw new Error(plan.message)

  const toCreate = plan.rows.filter((r) => r.status === "new")
  const existing = plan.rows.filter((r) => r.status === "exists")
  const errored = plan.rows.filter((r) => r.status === "error")

  console.log(`Target DB host: ${TEST_DB_HOST}`)
  console.log(`File: ${filePath}`)
  console.log(
    `Customers in file: ${plan.rows.length} — new: ${toCreate.length}, already exist (skipped): ${existing.length}, errors (skipped): ${errored.length}`
  )
  console.log(`Dogs to create: ${toCreate.reduce((n, r) => n + r.dogs.length, 0)}`)
  console.log(`Numbers will be written to columns ${customerCol} (customer) and ${dogCol} (dog).`)
  for (const r of existing) console.log(`  exists: row ${r.rowNumbers.join(",")} ${r.email}`)
  for (const r of errored) console.log(`  error:  row ${r.rowNumbers.join(",")} ${r.email || "(no email)"} — ${r.problems.join("; ")}`)
  const warnings = plan.rows.flatMap((r) => r.warnings.map((w) => `row ${r.rowNumbers[0]} ${r.email}: ${w}`))
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`)
    for (const w of warnings.slice(0, 40)) console.log(`  ${w}`)
    if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more`)
  }

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply to import.")
    await prisma.$disconnect()
    return
  }

  // Make sure the spreadsheet can be saved (not locked open in Excel) BEFORE
  // creating any records, so the numbers can't get created-but-unrecorded.
  fs.closeSync(fs.openSync(filePath, "r+"))

  const results: { rowNumber: number; customerNumber: number; dogNumber: number | null }[] = []
  const failures: { rowNumber: number; email: string; message: string }[] = []
  const resultsFile = filePath.replace(/\.xlsx$/i, "") + ".import-results.json"

  for (const row of toCreate) {
    try {
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
        include: { dogs: { orderBy: { dogNumber: "asc" } } },
      })

      if (row.marketingOptOut) {
        // Same effect as setOptOut(user.id, "ABANDONED_BOOKING_REMINDER", true).
        await prisma.notificationPreference.upsert({
          where: { customerId: user.id },
          update: { perType: JSON.stringify({ ABANDONED_BOOKING_REMINDER: "off" }) },
          create: { customerId: user.id, perType: JSON.stringify({ ABANDONED_BOOKING_REMINDER: "off" }) },
        })
      }

      if (admin) {
        await prisma.auditLog.create({
          data: {
            actorId: admin.id,
            action: "CREATE_CUSTOMER",
            entity: "User",
            entityId: user.id,
            meta: `${row.forename} ${row.surname} <${row.email}> — imported from spreadsheet script (row ${row.rowNumbers.join(", ")}, ${row.dogs.length} dog${row.dogs.length === 1 ? "" : "s"})`,
          },
        })
      }

      if (row.dogs.length === 0) {
        results.push({ rowNumber: row.rowNumbers[0], customerNumber: user.customerNumber, dogNumber: null })
      }
      row.dogs.forEach((planned, idx) => {
        const created = user.dogs[idx]
        if (!created || created.name !== planned.name) {
          console.warn(`  warning: dog order mismatch for ${row.email} row ${planned.rowNumber} (${planned.name})`)
        }
        results.push({
          rowNumber: planned.rowNumber,
          customerNumber: user.customerNumber,
          dogNumber: created && created.name === planned.name ? created.dogNumber : null,
        })
      })
    } catch (error) {
      const code = (error as { code?: string })?.code
      failures.push({
        rowNumber: row.rowNumbers[0],
        email: row.email,
        message: code === "P2002" ? "An account with this email already exists." : String(error),
      })
    }
  }

  // Safety net: keep the results on disk before touching the spreadsheet.
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2))

  const headerRow = sheet.getRow(4)
  headerRow.getCell(customerCol).value = "Customer Number"
  headerRow.getCell(dogCol).value = "Dog Number"
  for (const r of results) {
    const excelRow = sheet.getRow(r.rowNumber)
    excelRow.getCell(customerCol).value = formatCustomerNumber(r.customerNumber)
    if (r.dogNumber !== null) excelRow.getCell(dogCol).value = formatDogNumber(r.dogNumber)
  }
  await workbook.xlsx.writeFile(filePath)

  console.log(
    `\nCreated ${new Set(results.map((r) => r.customerNumber)).size} customer(s) and ${results.filter((r) => r.dogNumber !== null).length} dog(s).`
  )
  console.log(`Numbers written back to ${filePath} (columns ${customerCol}-${dogCol}). Backup of results: ${resultsFile}`)
  if (failures.length) {
    console.log(`Failed (${failures.length}):`)
    for (const f of failures) console.log(`  row ${f.rowNumber} ${f.email}: ${f.message}`)
  }
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
