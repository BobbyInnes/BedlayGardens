import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"

export type VaccinationGateResult = {
  ok: boolean
  perDog: {
    dogId: string
    dogName: string
    missingTypes: string[]
  }[]
}

async function getRequiredVaccineTypes(): Promise<string[]> {
  const raw = await getSetting("required_vaccine_types", "")
  return raw
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean)
}

// Vet certificates print commercial brand names, not the generic disease
// category — e.g. Nobivac KC, Nobivac L4, Nobivac DHP(i), Vanguard Plus 7.
// A plain substring match of the record's type against a generic required
// type (e.g. "Kennel Cough") misses these even though the vaccination is
// genuinely valid and in date, so recognise the common UK brand aliases too.
const BRAND_ALIASES: Record<string, string[]> = {
  dhpp: ["dhppi", "dhlpp", "dhlppi", "dhp", "vanguard"],
  leptospirosis: ["lepto", "l4", "l2", "vanguard"],
  "kennel cough": ["kc", "bordetella"],
}

function recordCoversType(recordType: string, requiredType: string): boolean {
  const record = recordType.toLowerCase()
  const required = requiredType.toLowerCase().trim()
  if (record.includes(required)) return true
  return (BRAND_ALIASES[required] ?? []).some((alias) => record.includes(alias))
}

/** A dog "has" a required type if any record of that type covers through `throughDate`. */
export async function checkVaccinationGate(
  dogIds: string[],
  throughDate: Date
): Promise<VaccinationGateResult> {
  const requiredTypes = await getRequiredVaccineTypes()

  const dogs = await prisma.dog.findMany({
    where: { id: { in: dogIds } },
    include: { vaccinationRecords: true },
  })

  const perDog = dogs.map((dog) => {
    const missingTypes = requiredTypes.filter((requiredType) => {
      return !dog.vaccinationRecords.some(
        (record) =>
          recordCoversType(record.type, requiredType) && record.expiryDate >= throughDate
      )
    })
    return { dogId: dog.id, dogName: dog.name, missingTypes }
  })

  return { ok: perDog.every((entry) => entry.missingTypes.length === 0), perDog }
}
