"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { nextAgreementVersion } from "@/lib/agreement"
import { savePublicUpload } from "@/lib/storage"

const MAX_PDF_BYTES = 20 * 1024 * 1024

async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }
  return session
}

export type PublishAgreementState = { status: "idle" | "error" | "success"; message?: string }

// Publishes a brand new, immutable Agreement version from an uploaded PDF —
// never edits an existing one, since past SignedAgreements point at a
// specific Agreement.id/documentUrl, and swapping that file after the fact
// would mean a signature no longer matches what was actually signed. The
// previous active version is deactivated (not deleted) so its document stays
// reachable from its own SignedAgreement records.
export async function publishAgreement(
  _prevState: PublishAgreementState,
  formData: FormData
): Promise<PublishAgreementState> {
  const session = await requireAdmin()

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a PDF file to upload." }
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { status: "error", message: "Only PDF files are accepted." }
  }
  if (file.size > MAX_PDF_BYTES) {
    return { status: "error", message: "That file is too large (20MB max)." }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const documentUrl = await savePublicUpload("agreements", file.name, buffer)

  const currentActive = await prisma.agreement.findFirst({ where: { active: true } })
  const version = nextAgreementVersion(currentActive?.version)

  const published = await prisma.$transaction(async (tx) => {
    if (currentActive) {
      await tx.agreement.update({ where: { id: currentActive.id }, data: { active: false } })
    }
    return tx.agreement.create({ data: { version, documentUrl, active: true } })
  })

  await logAudit({
    actorId: session.user.id,
    action: "PUBLISH_AGREEMENT",
    entity: "Agreement",
    entityId: published.id,
    meta: `Version ${version} — ${documentUrl}`,
  })

  revalidatePath("/admin/agreement")
  revalidatePath("/portal/agreement")
  return { status: "success", message: `Version ${version} published — customers will now be asked to sign it.` }
}
