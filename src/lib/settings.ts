import { cache } from "react"
import { prisma } from "@/lib/prisma"

export const getSettings = cache(async (): Promise<Record<string, string>> => {
  const rows = await prisma.setting.findMany()
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
})

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const settings = await getSettings()
  return settings[key] ?? fallback
}
