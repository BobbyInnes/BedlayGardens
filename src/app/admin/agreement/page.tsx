import type { Metadata } from "next"
import { FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { nextAgreementVersion } from "@/lib/agreement"
import { Badge } from "@/components/ui/badge"
import { PublishAgreementForm } from "@/components/admin/publish-agreement-button"

export const metadata: Metadata = {
  title: "Our Terms and Conditions | Admin",
}

export default async function AdminAgreementPage() {
  const agreements = await prisma.agreement.findMany({
    orderBy: { publishedAt: "desc" },
    include: { _count: { select: { signedAgreements: true } } },
  })

  const currentActive = agreements.find((a) => a.active)
  const nextVersion = nextAgreementVersion(currentActive?.version)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Our Terms and Conditions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the terms customers must sign before booking as a PDF. Customers see a link to this
          document (opening in a new tab) on the sign-agreement page. Publishing a new version never
          changes what anyone has already signed — it creates a new, permanent version and asks every
          customer, including those who signed an earlier one, to sign it.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Current version</h2>
        {currentActive?.documentUrl ? (
          <a
            href={currentActive.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-lg border border-border p-4 text-sm font-medium text-primary hover:bg-muted"
          >
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            Version {currentActive.version} — view PDF
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No version is currently published.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Publish a new version</h2>
        <PublishAgreementForm nextVersion={nextVersion} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Version history</h2>
        {agreements.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Published</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Signed by</th>
                  <th className="px-4 py-2 font-medium">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agreements.map((agreement) => (
                  <tr key={agreement.id}>
                    <td className="px-4 py-2 font-medium">Version {agreement.version}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {agreement.publishedAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={agreement.active ? "default" : "outline"}>
                        {agreement.active ? "Active" : "Superseded"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {agreement._count.signedAgreements} customer{agreement._count.signedAgreements === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-2">
                      {agreement.documentUrl ? (
                        <a
                          href={agreement.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          View PDF
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No version has been published yet.</p>
        )}
      </section>
    </div>
  )
}
