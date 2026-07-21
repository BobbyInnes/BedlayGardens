"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAgreement } from "@/lib/agreement"
import { generateAgreementPdf } from "@/lib/agreement-pdf"
import { saveUpload } from "@/lib/storage"
import { getSetting } from "@/lib/settings"

export type SignAgreementState = { status: "idle" | "error"; message?: string }

const signSchema = z.object({
  agreementId: z.string().min(1),
  signedName: z.string().trim().min(2, "Enter your full name to sign"),
  agree: z.literal("on", { message: "You must confirm you agree" }),
  returnTo: z.string().optional(),
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

  const headerList = await headers()
  const ipAddress =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown"
  const signedAt = new Date()
  const businessName = await getSetting("business_name", "Bedlay Gardens LTD")

  const pdfBuffer = await generateAgreementPdf({
    businessName,
    version: agreement.version,
    text: agreement.text,
    signedName: parsed.data.signedName,
    signedAt,
    ipAddress,
  })
  const pdfUrl = await saveUpload(`agreements/${session.user.id}`, "agreement.pdf", pdfBuffer)

  await prisma.signedAgreement.create({
    data: {
      agreementId: agreement.id,
      customerId: session.user.id,
      signedName: parsed.data.signedName,
      signedAt,
      ipAddress,
      pdfUrl,
    },
  })

  redirect(parsed.data.returnTo || "/portal")
}
