import { z } from "zod"

// Pure parsing/validation for the admin "Import customers" upload — no
// database access here, so it can be exercised on any file safely. The server
// actions in src/app/admin/import/actions.ts read the uploaded .xlsx into a
// plain 2D array of cell values and add the DB lookups (existing emails,
// referral source ids); this file only turns that array into a plan.
//
// Shaped around the "upload test1.xlsx" template: row 1 is a machine field
// key (ignored here), rows 2-4 are the section / card / field-name labels
// that the site's own account, vet and dog forms use, and data starts at
// row 5. Column A is always the customer's email. One row is one customer's
// account details *and* one dog — a customer with several dogs appears as
// several rows repeating the same account/vet columns, grouped back together
// here by email.

// ---------------------------------------------------------------------------
// Field cleaners
// ---------------------------------------------------------------------------

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

// Only re-cases values that are entirely UPPER or lower case ("OSCAR",
// "snoop") — anything already mixed-case is left exactly as typed.
function tidyCase(s: string): string {
  const v = collapse(s)
  if (!/[a-z]/i.test(v)) return v
  if (v !== v.toUpperCase() && v !== v.toLowerCase()) return v
  return v.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
}

function truncate(s: string | null, max: number): string | null {
  return s === null ? null : s.length > max ? s.slice(0, max) : s
}

// A cell's raw value, as read off the sheet by the server action: text,
// number, Date, or empty. Never a formula/rich-text object — the action
// unwraps those before this file sees them.
export type CellValue = string | number | boolean | Date | null | undefined

function cellToText(v: CellValue): string {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return v.toISOString()
  return collapse(String(v))
}

// Excel drops the leading zero from numbers stored as numbers, so a
// 10-digit UK-shaped number missing its 0 gets it back.
function cleanPhone(v: CellValue): string | null {
  let n = cellToText(v).replace(/[^0-9+]/g, "")
  if (/^[1-9]\d{9}$/.test(n)) n = "0" + n
  n = n.replace(/\D/g, "")
  return n.length >= 6 && n.length <= 50 ? n : null
}

function buildDate(y: number, mo: number, d: number, allowFuture = false): Date | null {
  const date = new Date(Date.UTC(y, mo, d, 12))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo || date.getUTCDate() !== d) return null
  return !allowFuture && date.getTime() > Date.now() ? null : date
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

// Accepts 01-Oct-24 / 01-Oct-2024, UK 25/09/2021 (day first), and 2021-09-25
// — only used as a fallback when the cell wasn't a real Excel date.
function parseDateText(raw: string, allowFuture = false): Date | null {
  const s = raw.trim()
  if (!s) return null
  let m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2}|\d{4})$/)
  if (m) {
    const mo = MONTHS.indexOf(m[2].toLowerCase())
    if (mo === -1) return null
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return buildDate(y, mo, Number(m[1]), allowFuture)
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return buildDate(Number(m[3]), Number(m[2]) - 1, Number(m[1]), allowFuture)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return buildDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), allowFuture)
  return null
}

// allowFuture is for vaccination expiry dates, which legitimately sit ahead
// of today; a dog's date of birth and a vaccine's from date never do.
function cellToDate(v: CellValue, allowFuture = false): Date | null {
  if (v instanceof Date) {
    return buildDate(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), allowFuture)
  }
  const text = cellToText(v)
  return text ? parseDateText(text, allowFuture) : null
}

// "5 Years 10 Months", "4 Years", "8 months", "12 weeks" -> an estimated date
// of birth that far back from today. Only a fallback for when the real Date of
// Birth cell is empty.
function estimateDobFromAge(v: CellValue): Date | null {
  const text = cellToText(v).toLowerCase()
  if (!text) return null
  const years = Number(text.match(/(\d+)\s*(?:years?|yrs?|y)\b/)?.[1] ?? 0)
  const months = Number(text.match(/(\d+)\s*(?:months?|mths?|mos?)\b/)?.[1] ?? 0)
  const weeks = Number(text.match(/(\d+)\s*(?:weeks?|wks?)\b/)?.[1] ?? 0)
  if (!years && !months && !weeks) return null
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth() - months, now.getUTCDate() - weeks * 7, 12))
}

export type DogSizeValue = "MINIATURE" | "SMALL" | "MEDIUM" | "LARGE" | "GIANT"

function mapDogSize(v: CellValue): DogSizeValue | null {
  const s = cellToText(v).toLowerCase()
  if (/mini/.test(s)) return "MINIATURE"
  if (/small/.test(s)) return "SMALL"
  if (/medium/.test(s)) return "MEDIUM"
  if (/giant/.test(s)) return "GIANT"
  if (/large/.test(s)) return "LARGE"
  return null
}

// "20", "21kg", "38.5kgs", "45.04kg" → kilograms. Sanity-bounded so a stray
// non-weight value (e.g. a mis-filled column) doesn't get stored as one.
function parseWeightKg(v: CellValue): number | null {
  if (typeof v === "number") return v > 0 && v <= 150 ? v : null
  const text = cellToText(v)
  if (!text) return null
  const m = text.match(/(\d+(\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 && n <= 150 ? n : null
}

const truthy = (s: string) => /^(yes|true|y|1)$/i.test(s.trim())

function mapNeutered(v: CellValue): boolean {
  return /^(yes|true|castrated|spayed|y|1)$/i.test(cellToText(v))
}

// Free-text "How Heard" → one of the Referral Sources dropdown option names.
// The original wording is always kept in the customer's admin notes.
export function mapHeardAbout(raw: string): string | null {
  const s = raw.toLowerCase()
  if (!s.trim()) return null
  if (/google|bing|yahoo|search/.test(s)) return "Search Engine"
  if (/facebook|instagram|tiktok|twitter|youtube|linkedin|social/.test(s)) return "Social Media"
  if (/friend|family|word of mouth|recommend|referr|sister|brother|mum|mom|dad|colleague|neighbo/.test(s)) {
    return "Word of Mouth / Referral"
  }
  if (/advert|billboard|leaflet|flyer|newspaper|radio|\btv\b/.test(s)) return "Advertisement"
  if (/newsletter/.test(s)) return "Email Newsletter"
  if (/blog|article|press/.test(s)) return "Blog or Article"
  if (/podcast|video/.test(s)) return "Podcast or Video"
  if (/event|show|expo/.test(s)) return "Event or Trade Show"
  return "Other"
}

// ---------------------------------------------------------------------------
// Header mapping (rows 2-4: section / card / field name)
// ---------------------------------------------------------------------------

// Case/whitespace/punctuation-insensitive so "Town/ city" and "Town/city"
// (both appear in the real template) match the same key.
function normalizeLabel(v: CellValue): string {
  return cellToText(v).toLowerCase().replace(/[^a-z0-9]+/g, "")
}

type FieldTarget =
  | "salutation"
  | "forename"
  | "surname"
  | "addressLine1"
  | "addressLine2"
  | "addressCity"
  | "addressPostcode"
  | "phone"
  | "workPhone"
  | "marketingOk"
  | "howHeard"
  | "vetPracticeName"
  | "vetContactName"
  | "vetAddressLine1"
  | "vetAddressLine2"
  | "vetCity"
  | "vetPostcode"
  | "vetPhone"
  | "dogName"
  | "dogBreed"
  | "dogSpayed"
  | "dogSex"
  | "dogColor"
  | "dogDob"
  | "dogWeight"
  | "dogAge"
  | "dogSize"
  | "dogAllergies"
  | "dogMedicalSummary"
  | "dogFeedingNotes"
  | "vaccinationNotes"
  | "evaluationComplete"
  | "evaluationDate"
  | "evaluationOutcome"
  | "dhppFrom"
  | "dhppExpiry"
  | "kennelCoughFrom"
  | "kennelCoughExpiry"
  | "leptospirosisFrom"
  | "leptospirosisExpiry"

// Keyed by normalized `${section}|${card}|${field name}`, read from rows 2-4
// of the template. A column whose field-name row is blank (e.g. "Age" — the
// dog's Date of Birth is the field of record) is deliberately left out here
// and shown in unusedColumns instead of guessed at.
const FIELD_MAP: Record<string, FieldTarget> = {
  "account|contactdetails|title": "salutation",
  "account|contactdetails|forename": "forename",
  "account|contactdetails|surname": "surname",
  "account|contactdetails|addressline1": "addressLine1",
  "account|contactdetails|addressline2": "addressLine2",
  "account|contactdetails|towncity": "addressCity",
  "account|contactdetails|postcode": "addressPostcode",
  "account|contactdetails|mobiletelno": "phone",
  "account|contactdetails|workstelno": "workPhone",
  "account|notificationsettings|markettingemails": "marketingOk",
  "account|notificationsettings|howdidyouhearaboutus": "howHeard",
  // The current template files the question under Contact Details instead.
  "account|contactdetails|howdidyouhearaboutus": "howHeard",
  "account|vetpractice|practicename": "vetPracticeName",
  "account|vetpractice|consultantsname": "vetContactName",
  "account|vetpractice|addressline1": "vetAddressLine1",
  "account|vetpractice|addressline2": "vetAddressLine2",
  "account|vetpractice|towncity": "vetCity",
  "account|vetpractice|postcode": "vetPostcode",
  "account|vetpractice|phone": "vetPhone",
  "addadog|dogdetails|name": "dogName",
  "addadog|dogdetails|breed": "dogBreed",
  "addadog|dogdetails|neuteredspayed": "dogSpayed",
  "addadog|dogdetails|sex": "dogSex",
  "addadog|dogdetails|colour": "dogColor",
  "addadog|dogdetails|dateofbirth": "dogDob",
  "addadog|dogdetails|weight": "dogWeight",
  "addadog|dogdetails|size": "dogSize",
  "addadog|dogdetails|allergies": "dogAllergies",
  "addadog|medicalhistory|summary": "dogMedicalSummary",
  "addadog|feedinginstructions|summary": "dogFeedingNotes",
  // The template repeats the vaccination notes at customer level and dog
  // level with identical content; both feed the dog's vaccination notes.
  "vaccinations|vaccinationnotes|vaccinationnotes": "vaccinationNotes",
  "vaccinations|vaccinationsnotes|vaccinationsnotes": "vaccinationNotes",
  "customer|evaluationinformation|evaluationcomplete": "evaluationComplete",
  "customer|evaluationinformation|evaluationdate": "evaluationDate",
  "meetgreetreview|meetgreetreview|awaitingoutcome": "evaluationOutcome",
  "vaccinations|dhpp|fromdate": "dhppFrom",
  "vaccinations|dhpp|expirydate": "dhppExpiry",
  "vaccinations|kennelcough|fromdate": "kennelCoughFrom",
  "vaccinations|kennelcough|expirydate": "kennelCoughExpiry",
  "vaccinations|leptospirosis|fromdate": "leptospirosisFrom",
  "vaccinations|leptospirosis|expirydate": "leptospirosisExpiry",
}

function buildColumnMap(rows: CellValue[][]): { targets: Map<number, FieldTarget>; unusedColumns: string[] } {
  const sectionRow = rows[1] ?? []
  const cardRow = rows[2] ?? []
  const fieldRow = rows[3] ?? []
  const width = Math.max(sectionRow.length, cardRow.length, fieldRow.length)

  const targets = new Map<number, FieldTarget>()
  const unusedColumns: string[] = []

  for (let col = 1; col < width; col++) {
    const section = normalizeLabel(sectionRow[col])
    const card = normalizeLabel(cardRow[col])
    const field = normalizeLabel(fieldRow[col])
    const label = cellToText(fieldRow[col]) || cellToText(cardRow[col]) || cellToText(sectionRow[col])
    if (!section && !card && !field) continue // fully blank column, nothing to report

    let target = field ? FIELD_MAP[`${section}|${card}|${field}`] : undefined
    // The dog's Age column has no field name in rows 2-4 (only "Age" in the
    // machine-key row 1), so it's recognised by that plus its dog section.
    if (!target && !field && section === "addadog" && normalizeLabel(rows[0]?.[col]) === "age") target = "dogAge"
    if (target) {
      targets.set(col, target)
    } else {
      unusedColumns.push(label || `Column ${col + 1}`)
    }
  }

  return { targets, unusedColumns }
}

// ---------------------------------------------------------------------------
// The import plan
// ---------------------------------------------------------------------------

export type PlanStatus = "new" | "exists" | "error"

export type PlanVet = {
  practiceName: string | null
  contactName: string | null
  phone: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postcode: string | null
}

export type PlanDog = {
  // Spreadsheet row this dog came from, so a caller can report per-row results.
  rowNumber: number
  name: string
  breed: string
  neutered: boolean
  sex: string | null
  color: string | null
  dob: string | null
  weightKg: number | null
  size: DogSizeValue | null
  allergies: string | null
  medicalHistorySummary: string | null
  feedingNotes: string | null
  vaccinationNotes: string | null
  // From the sheet's Evaluation Complete / Date / outcome columns. When
  // evaluationComplete is true the dog is created with the Meet & Greet
  // checks bypassed.
  evaluationComplete: boolean
  evaluationDate: string | null
  evaluationNotes: string | null
  vaccinations: PlanVaccination[]
}

export type PlanVaccination = {
  type: string
  dateGiven: string
  expiryDate: string
  // VERIFIED when all three vaccines are in date, EXPIRED (shown as lapsed)
  // when this one's expiry has passed, otherwise UNVERIFIED for a normal
  // admin check.
  status: "VERIFIED" | "EXPIRED" | "UNVERIFIED"
}

export type PlanRow = {
  rowNumbers: number[]
  status: PlanStatus
  email: string
  salutation: string | null
  forename: string
  surname: string
  phone: string | null
  workPhone: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressCity: string | null
  addressPostcode: string | null
  marketingOptOut: boolean
  heardRaw: string
  referralSourceName: string | null
  referralSourceId: string | null
  adminNotes: string | null
  vet: PlanVet | null
  dogs: PlanDog[]
  problems: string[]
  warnings: string[]
}

export type ImportPlan =
  | { ok: true; rows: PlanRow[]; unusedColumns: string[] }
  | { ok: false; message: string }

// Expiry is taken from the sheet when present; otherwise calculated from the
// from date using the same validity as the portal's fixed vaccines
// (src/app/portal/vaccinations/vaccine-types.ts).
const VACCINE_COLUMNS = [
  { type: "DHPP", from: "dhppFrom", expiry: "dhppExpiry", validityYears: 3 },
  { type: "Kennel Cough", from: "kennelCoughFrom", expiry: "kennelCoughExpiry", validityYears: 1 },
  { type: "Leptospirosis", from: "leptospirosisFrom", expiry: "leptospirosisExpiry", validityYears: 1 },
] as const

const emailSchema = z.string().email().max(200)
const DATA_START_ROW_INDEX = 4 // spreadsheet row 5 (0-indexed rows array)

export function planCustomerImport(
  rows: CellValue[][],
  ctx: {
    existingEmails: Set<string>
    referralIdByName: Map<string, string>
  }
): ImportPlan {
  if (rows.length <= DATA_START_ROW_INDEX) {
    return { ok: false, message: "The file needs data starting at row 5 (rows 1-4 are the header)." }
  }

  const { targets, unusedColumns } = buildColumnMap(rows)
  const get = (row: CellValue[], target: FieldTarget): CellValue => {
    for (const [col, t] of targets) if (t === target) return row[col]
    return undefined
  }

  // Text of every column mapped to a target, de-duplicated and joined, for
  // the notes that appear twice in the template with identical content.
  const getJoined = (row: CellValue[], target: FieldTarget): string | null => {
    const seen: string[] = []
    for (const [col, t] of targets) {
      if (t !== target) continue
      const text = cellToText(row[col])
      if (text && !seen.includes(text)) seen.push(text)
    }
    return seen.length ? seen.join("\n") : null
  }

  const plans = new Map<string, PlanRow>()
  const order: string[] = []

  for (let i = DATA_START_ROW_INDEX; i < rows.length; i++) {
    const row = rows[i] ?? []
    const rowNumber = i + 1
    if (row.every((c) => cellToText(c) === "")) continue

    const email = cellToText(row[0]).toLowerCase()

    let plan = plans.get(email)
    if (!plan) {
      const problems: string[] = []
      const forename = tidyCase(cellToText(get(row, "forename"))).slice(0, 100)
      const surname = tidyCase(cellToText(get(row, "surname"))).slice(0, 100)
      if (!emailSchema.safeParse(email).success) problems.push("Missing or invalid email address")
      if (!forename) problems.push("Missing first name")
      if (!surname) problems.push("Missing surname")

      const phone = cleanPhone(get(row, "phone"))
      const workPhone = cleanPhone(get(row, "workPhone"))
      const warnings: string[] = []
      if (!phone && !workPhone) warnings.push("No phone number")

      const addressLine1 = truncate(collapse(cellToText(get(row, "addressLine1"))) || null, 200)
      if (!addressLine1) warnings.push("No address")

      const heardRaw = cellToText(get(row, "howHeard"))
      const referralSourceName = mapHeardAbout(heardRaw)
      const referralSourceId = referralSourceName
        ? (ctx.referralIdByName.get(referralSourceName.toLowerCase()) ?? null)
        : null
      if (referralSourceName && !referralSourceId) {
        warnings.push(`No "${referralSourceName}" option in Referral Sources — how-heard not linked`)
      }

      // "Marketing Ok" must say Yes for consent — anything else (blank
      // included) is treated as not consented, since consent can't be
      // assumed from silence.
      const marketingOptOut = !truthy(cellToText(get(row, "marketingOk")))

      const practiceName = collapse(cellToText(get(row, "vetPracticeName"))) || null
      let contactName = collapse(cellToText(get(row, "vetContactName"))) || null
      if (contactName && (contactName.toLowerCase() === practiceName?.toLowerCase() || /^any vet/i.test(contactName))) {
        contactName = null
      }
      const vetPhone = cleanPhone(get(row, "vetPhone"))
      const vetAddressLine1 = truncate(collapse(cellToText(get(row, "vetAddressLine1"))) || null, 200)
      const vetAddressLine2 = truncate(collapse(cellToText(get(row, "vetAddressLine2"))) || null, 200)
      const vetCity = truncate(collapse(cellToText(get(row, "vetCity"))) || null, 100)
      const vetPostcode = collapse(cellToText(get(row, "vetPostcode"))).toUpperCase() || null
      const hasVet = practiceName || contactName || vetPhone || vetAddressLine1
      const vet: PlanVet | null = hasVet
        ? {
            practiceName: truncate(practiceName, 200),
            contactName: truncate(contactName, 200),
            phone: vetPhone,
            addressLine1: vetAddressLine1,
            addressLine2: vetAddressLine2,
            city: vetCity,
            postcode: vetPostcode,
          }
        : null

      const noteLines = ["Imported from spreadsheet upload."]
      if (heardRaw) noteLines.push(`How heard (original wording): ${heardRaw}`)

      let status: PlanStatus = "new"
      if (problems.length > 0) status = "error"
      else if (ctx.existingEmails.has(email)) status = "exists"

      plan = {
        rowNumbers: [],
        status,
        email,
        salutation: truncate(collapse(cellToText(get(row, "salutation"))) || null, 20),
        forename,
        surname,
        phone,
        workPhone,
        addressLine1,
        addressLine2: truncate(collapse(cellToText(get(row, "addressLine2"))) || null, 200),
        addressCity: truncate(collapse(cellToText(get(row, "addressCity"))) || null, 100),
        addressPostcode: collapse(cellToText(get(row, "addressPostcode"))).toUpperCase() || null,
        marketingOptOut,
        heardRaw,
        referralSourceName,
        referralSourceId,
        adminNotes: noteLines.join("\n"),
        vet,
        dogs: [],
        problems,
        warnings,
      }
      plans.set(email, plan)
      order.push(email)
    } else {
      const forename = tidyCase(cellToText(get(row, "forename")))
      const surname = tidyCase(cellToText(get(row, "surname")))
      if (forename && surname && `${forename} ${surname}` !== `${plan.forename} ${plan.surname}`) {
        plan.warnings.push(`Row ${rowNumber}: name differs from row ${plan.rowNumbers[0]} for the same email — kept the first`)
      }
    }

    plan.rowNumbers.push(rowNumber)

    const dogName = tidyCase(cellToText(get(row, "dogName"))).slice(0, 100)
    if (dogName) {
      let breed = collapse(cellToText(get(row, "dogBreed")))
      if (!breed) {
        breed = "Unknown"
        plan.warnings.push(`${dogName}: no breed given — set to "Unknown"`)
      }
      const weightCell = get(row, "dogWeight")
      const weightKg = parseWeightKg(weightCell)
      if (weightCell !== undefined && cellToText(weightCell) !== "" && weightKg === null) {
        plan.warnings.push(`${dogName}: couldn't read weight "${cellToText(weightCell)}"`)
      }
      const dob = cellToDate(get(row, "dogDob")) ?? estimateDobFromAge(get(row, "dogAge"))

      const sizeCell = get(row, "dogSize")
      const size = mapDogSize(sizeCell)
      if (cellToText(sizeCell) !== "" && !size) {
        plan.warnings.push(`${dogName}: couldn't read size "${cellToText(sizeCell)}"`)
      }

      const vaccinations: PlanVaccination[] = []
      for (const v of VACCINE_COLUMNS) {
        const fromCell = get(row, v.from)
        const expiryCell = get(row, v.expiry)
        if (cellToText(fromCell) === "" && cellToText(expiryCell) === "") continue
        const from = cellToDate(fromCell)
        if (!from) {
          plan.warnings.push(`${dogName}: ${v.type} skipped - no readable from date`)
          continue
        }
        const expiry =
          cellToDate(expiryCell, true) ??
          new Date(Date.UTC(from.getUTCFullYear() + v.validityYears, from.getUTCMonth(), from.getUTCDate(), 12))
        vaccinations.push({
          type: v.type,
          dateGiven: from.toISOString(),
          expiryDate: expiry.toISOString(),
          status: "UNVERIFIED",
        })
      }

      // All three vaccines with a future expiry -> all verified. Any vaccine
      // whose expiry has already passed -> lapsed (EXPIRED).
      const now = Date.now()
      const allInDate =
        vaccinations.length === VACCINE_COLUMNS.length &&
        vaccinations.every((v) => new Date(v.expiryDate).getTime() > now)
      for (const v of vaccinations) {
        if (allInDate) v.status = "VERIFIED"
        else if (new Date(v.expiryDate).getTime() <= now) v.status = "EXPIRED"
      }

      const evaluationComplete = truthy(cellToText(get(row, "evaluationComplete")))
      const evaluationDate = cellToDate(get(row, "evaluationDate"))
      const evaluationNotes = cellToText(get(row, "evaluationOutcome")) || null

      plan.dogs.push({
        rowNumber,
        name: dogName,
        breed: breed.slice(0, 100),
        neutered: mapNeutered(get(row, "dogSpayed")),
        sex: truncate(collapse(cellToText(get(row, "dogSex"))).toLowerCase() || null, 20),
        color: truncate(collapse(cellToText(get(row, "dogColor"))) || null, 100),
        dob: dob ? dob.toISOString() : null,
        weightKg,
        size,
        allergies: getJoined(row, "dogAllergies"),
        medicalHistorySummary: getJoined(row, "dogMedicalSummary"),
        feedingNotes: getJoined(row, "dogFeedingNotes"),
        vaccinationNotes: getJoined(row, "vaccinationNotes"),
        evaluationComplete,
        evaluationDate: evaluationDate ? evaluationDate.toISOString() : null,
        evaluationNotes: truncate(evaluationNotes, 2000),
        vaccinations,
      })
    } else if (targets.size > 0 && row.some((c, idx) => idx > 0 && cellToText(c) !== "")) {
      // Row has other data but no dog name — only worth flagging once we
      // know the file has any dog columns mapped at all.
      const hasDogColumns = [...targets.values()].some((t) => t.startsWith("dog"))
      if (hasDogColumns) plan.warnings.push(`Row ${rowNumber}: no dog name — no dog added for this row`)
    }
  }

  if (order.length === 0) return { ok: false, message: "No customer rows found in the file." }
  return { ok: true, rows: order.map((email) => plans.get(email)!), unusedColumns }
}
