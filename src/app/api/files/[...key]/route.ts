import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { contentTypeForKey, readUpload } from "@/lib/storage"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key: keyParts } = await params
  const [category, dogId] = keyParts

  if ((category !== "dogs" && category !== "vaccinations") || !dogId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const dog = await prisma.dog.findUnique({ where: { id: dogId } })
  if (!dog) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const isOwner = dog.ownerId === session.user.id
  const isStaffOrAdmin = session.user.role === "STAFF" || session.user.role === "ADMIN"
  if (!isOwner && !isStaffOrAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const key = keyParts.join("/")
  try {
    const data = await readUpload(key)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
