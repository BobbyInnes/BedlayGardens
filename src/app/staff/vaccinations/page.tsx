import type { Metadata } from "next"
import Link from "next/link"
import { FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { VaccinationVerifyButtons } from "@/components/staff/vaccination-verify-buttons"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { fullName } from "@/lib/format"

export const metadata: Metadata = {
  title: "Vaccinations | Staff",
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]

function isImage(key: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => key.toLowerCase().endsWith(ext))
}

export default async function StaffVaccinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ dog?: string; owner?: string }>
}) {
  const { dog = "", owner = "" } = await searchParams

  const records = await prisma.vaccinationRecord.findMany({
    where: {
      status: "UNVERIFIED",
      ...(dog.trim() ? { dog: { name: { contains: dog.trim(), mode: "insensitive" } } } : {}),
      ...(owner.trim()
        ? {
            dog: {
              owner: {
                OR: [
                  { forename: { contains: owner.trim(), mode: "insensitive" } },
                  { surname: { contains: owner.trim(), mode: "insensitive" } },
                  { email: { contains: owner.trim(), mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
    },
    include: { dog: { include: { owner: true } } },
    orderBy: { dateGiven: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vaccinations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unverified records awaiting review ({records.length})
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="dog">Dog name</Label>
          <Input id="dog" name="dog" defaultValue={dog} className="w-48" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner">Owner name or email</Label>
          <Input id="owner" name="owner" defaultValue={owner} className="w-64" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {records.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {records.map((record) => (
            <li key={record.id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
              <div className="flex items-center gap-4">
                {record.documentUrl ? (
                  isImage(record.documentUrl) ? (
                    <Link href={`/api/files/${record.documentUrl}`} target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${record.documentUrl}`}
                        alt={`${record.type} certificate`}
                        className="size-14 shrink-0 rounded-md border border-border object-cover"
                      />
                    </Link>
                  ) : (
                    <Link
                      href={`/api/files/${record.documentUrl}`}
                      target="_blank"
                      className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted"
                    >
                      <FileText className="size-6 text-muted-foreground" />
                    </Link>
                  )
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
                    No file
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {record.dog.name} — {record.type}
                  </p>
                  <p className="text-muted-foreground">
                    Owner: {fullName(record.dog.owner)} ({record.dog.owner.email})
                  </p>
                  <p className="text-muted-foreground">
                    From Date: {record.dateGiven.toLocaleDateString("en-GB")} · Expiry Date:{" "}
                    {record.expiryDate.toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
              <VaccinationVerifyButtons recordId={record.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No records waiting for verification.</p>
      )}
    </div>
  )
}
