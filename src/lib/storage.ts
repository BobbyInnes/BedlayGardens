import { randomUUID } from "node:crypto"
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"

// Cloudflare R2 is S3-API-compatible. Two buckets: PRIVATE_BUCKET has no
// public access at all (vaccination certs, dog photos, agreements, pupdate
// media — only ever read server-side via the auth-checked /api/files proxy),
// PUBLIC_BUCKET is exposed at PUBLIC_BASE_URL (gallery/hero media).
//
// R2_ACCOUNT_ID is accepted either as the bare account ID or as the full R2
// endpoint (Cloudflare's dashboard shows the full "S3 API" endpoint, which is
// easy to paste in whole by mistake), so both forms resolve to the same URL.
function r2Endpoint(): string {
  const raw = (process.env.R2_ACCOUNT_ID ?? "").trim()
  const bareId = raw.replace(/^https?:\/\//, "").replace(/\.r2\.cloudflarestorage\.com\/?$/, "")
  return `https://${bareId}.r2.cloudflarestorage.com`
}

const s3 = new S3Client({
  region: "auto",
  endpoint: r2Endpoint(),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
})

const PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET ?? ""
const PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET ?? ""
const PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
}

function assertSafeKey(key: string) {
  if (key.includes("..") || key.startsWith("/")) {
    throw new Error("Invalid storage key")
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100)
}

function extensionOf(key: string): string {
  const match = /\.[a-z0-9]+$/i.exec(key)
  return match ? match[0].toLowerCase() : ""
}

export function contentTypeForKey(key: string): string {
  return CONTENT_TYPES[extensionOf(key)] ?? "application/octet-stream"
}

export async function saveUpload(
  folder: string,
  filename: string,
  data: Buffer
): Promise<string> {
  const key = `${folder}/${randomUUID()}-${sanitizeFilename(filename)}`
  assertSafeKey(key)
  await s3.send(
    new PutObjectCommand({
      Bucket: PRIVATE_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentTypeForKey(key),
    })
  )
  return key
}

export async function readUpload(key: string): Promise<Buffer> {
  assertSafeKey(key)
  const response = await s3.send(new GetObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key }))
  const bytes = await response.Body?.transformToByteArray()
  if (!bytes) throw new Error("Empty object body")
  return Buffer.from(bytes)
}

export async function deleteUpload(key: string): Promise<void> {
  assertSafeKey(key)
  await s3.send(new DeleteObjectCommand({ Bucket: PRIVATE_BUCKET, Key: key })).catch(() => {})
}

/** For public-facing assets (gallery/hero media) that don't need auth-gated serving. */
export async function savePublicUpload(
  folder: string,
  filename: string,
  data: Buffer
): Promise<string> {
  const key = `${folder}/${randomUUID()}-${sanitizeFilename(filename)}`
  assertSafeKey(key)
  await s3.send(
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentTypeForKey(key),
    })
  )
  return `${PUBLIC_BASE_URL}/${key}`
}

export async function deletePublicUpload(publicUrl: string): Promise<void> {
  if (!publicUrl.startsWith(PUBLIC_BASE_URL)) return
  const key = publicUrl.slice(PUBLIC_BASE_URL.length + 1)
  await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key })).catch(() => {})
}
