"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAgreement, matchesCustomerName } from "@/lib/agreement"
import { generateAgreementPdf } from "@/lib/agreement-pdf"
import { saveUpload } from "@/lib/storage"
import { getSetting } from "@/lib/settings"
import { logAudit } from "@/lib/audit"
import { fullName } from "@/lib/format"

export type SignAgreementState = { status: "idle" | "error"; message?: string }

const signSchema = z.object({
  agreementId: z.string().min(1),
  signedName: z.string().trim().min(2, "Enter your full name to sign"),
  agree: z.literal("on", { message: "You must confirm you agree" }),
  // FormData.get() returns null (not undefined) for an absent field — which
  // is what happens whenever this page is reached without a `?returnTo=`
  // param (the hidden input only renders when one's present, see
  // SignAgreementForm) — so .optional() alone rejects that case; .nullish()
  // accepts both.
  returnTo: z.string().nullish(),
})

export async function signAgreement(
  _prevState: SignAgreementState,
  formData: FormData
): Promise<SignAgreementState> {
  const session = await auth()
  if (!session?.user) return { status: "error", message: "Please log in." }

  const parsed = signSchema.safeParse({
    agreementId: formData.get("agreementId"),
    signedName: formData.get("signedName"),
    agree: formData.get("agree"),
    returnTo: formData.get("returnTo"),
  })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid submission." }
  }

  const agreement = await getActiveAgreement()
  if (!agreement || agreement.id !== parsed.data.agreementId) {
    return { status: "error", message: "This agreement version is out of date — please refresh the page." }
  }
  if (!agreement.documentUrl) {
    return { status: "error", message: "No agreement document is currently published." }
  }

  const customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { salutation: true, forename: true, surname: true, email: true },
  })
  if (!customer) return { status: "error", message: "Please log in." }
  if (!matchesCustomerName(parsed.data.signedName, customer)) {
    return {
      status: "error",
      message: "The name you typed doesn't match the name on your account — please sign with your own name.",
    }
  }

  const headerList = await headers()
  const ipAddress =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown"
  const signedAt = new Date()
  const businessName = await getSetting("business_name", "Bedlay Gardens LTD")

  const pdfBuffer = await generateAgreementPdf({
    businessName,
    version: agreement.version,
    documentUrl: agreement.documentUrl,
    signedName: parsed.data.signedName,
    signedAt,
    ipAddress,
  })
  const pdfUrl = await saveUpload(`agreements/${session.user.id}`, "agreement.pdf", pdfBuffer)

  const signedAgreement = await prisma.signedAgreement.create({
    data: {
      agreementId: agreement.id,
      customerId: session.user.id,
      signedName: parsed.data.signedName,
      signedAt,
      ipAddress,
      pdfUrl,
    },
  })

  await logAudit({
    actorId: session.user.id,
    action: "SIGN_AGREEMENT",
    entity: "SignedAgreement",
    entityId: signedAgreement.id,
    meta: `Terms and Conditions v${agreement.version} signed by ${fullName(customer)} <${customer.email}> — typed name "${parsed.data.signedName}" — IP ${ipAddress}`,
  })

  redirect(parsed.data.returnTo || "/portal")
}
