import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads")

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

function assertSafeKey(key: string) {
  const resolved = path.resolve(STORAGE_ROOT, key)
  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid storage key")
  }
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100)
}

export function contentTypeForKey(key: string): string {
  const ext = path.extname(key).toLowerCase()
  return CONTENT_TYPES[ext] ?? "application/octet-stream"
}

export async function saveUpload(
  folder: string,
  filename: string,
  data: Buffer
): Promise<string> {
  const key = path.posix.join(folder, `${randomUUID()}-${sanitizeFilename(filename)}`)
  assertSafeKey(key)
  const fullPath = path.join(STORAGE_ROOT, key)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, data)
  return key
}

export async function readUpload(key: string): Promise<Buffer> {
  assertSafeKey(key)
  return readFile(path.join(STORAGE_ROOT, key))
}

export async function deleteUpload(key: string): Promise<void> {
  assertSafeKey(key)
  await rm(path.join(STORAGE_ROOT, key), { force: true })
}
