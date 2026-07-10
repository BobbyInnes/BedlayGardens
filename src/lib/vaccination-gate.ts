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
          record.type.toLowerCase().includes(requiredType.toLowerCase()) &&
          record.expiryDate >= throughDate
      )
    })
    return { dogId: dog.id, dogName: dog.name, missingTypes }
  })

  return { ok: perDog.every((entry) => entry.missingTypes.length === 0), perDog }
}
