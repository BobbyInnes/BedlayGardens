import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveUpload } from "@/lib/storage"
import { extractVaccinationData } from "@/lib/vaccination-extraction"

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
])
const MAX_SIZE_BYTES = 20 * 1024 * 1024

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const dogId = formData.get("dogId")
  const file = formData.get("file")

  if (typeof dogId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing dogId or file" }, { status: 400 })
  }

  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog || dog.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Dog not found" }, { status: 404 })
  }

  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileKey = await saveUpload(`vaccinations/${dogId}`, file.name, buffer)
  const result = await extractVaccinationData(buffer, file.type)

  return NextResponse.json({
    fileKey,
    fileName: file.name,
    vaccines: result?.vaccines ?? [],
    dogNameOnCertificate: result?.dogNameOnCertificate ?? null,
  })
}
