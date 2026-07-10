import type { Metadata } from "next"
import Link from "next/link"
import { FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { VaccinationVerifyButtons } from "@/components/admin/vaccination-verify-buttons"

export const metadata: Metadata = {
  title: "Vaccinations | Admin",
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]

function isImage(key: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => key.toLowerCase().endsWith(ext))
}

export default async function AdminVaccinationsPage() {
  const records = await prisma.vaccinationRecord.findMany({
    where: { status: "UNVERIFIED" },
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
                    Owner: {record.dog.owner.name} ({record.dog.owner.email})
                  </p>
                  <p className="text-muted-foreground">
                    Given {record.dateGiven.toLocaleDateString("en-GB")} · Expires{" "}
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
