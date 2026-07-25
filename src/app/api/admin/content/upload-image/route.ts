import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { savePublicUpload } from "@/lib/storage"

// A plain Route Handler (not a Server Action) on purpose — the admin
// RichTextEditor inserts the uploaded image directly into its contentEditable
// DOM, outside of React's render cycle. Calling this as a Server Action would
// trigger Next's automatic refresh of the current route's server-rendered
// content immediately after the call resolves, wiping out that DOM insertion
// before the admin gets a chance to click Save.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("image")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image selected." }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type — use JPEG, PNG, WebP, or GIF." },
      { status: 400 }
    )
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 5MB)." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const url = await savePublicUpload("content", file.name, buffer)
  return NextResponse.json({ url })
}
