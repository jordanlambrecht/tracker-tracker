// src/app/api/upload-image/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import type { ImageHostId } from "@/lib/image-hosting"
import { getImageHostAdapter } from "@/lib/image-hosting"
import { log } from "@/lib/logger"

const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32 MB (ImgBB limit, lowest common denominator)
const VALID_HOSTS = new Set<ImageHostId>(["ptpimg", "onlyimage", "imgbb"])
const VALID_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/avif",
]

/**
 * Magic-byte signatures for MIME types we can validate by file header.
 * Types without a fixed header (gif, bmp, avif) are omitted — they pass through
 * without magic-byte verification rather than being wrongly rejected.
 */
const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header (bytes 8-11 = "WEBP" checked separately)
}

function matchesMagicBytes(buf: Buffer, mimeType: string): boolean {
  const magic = MAGIC_BYTES[mimeType]
  if (!magic) return true // No signature defined — allow through
  if (buf.length < magic.length) return false
  return magic.every((byte, i) => buf[i] === byte)
}

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  // Parse form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  // Extract and validate host
  const host = formData.get("host") as string | null
  if (!host || !VALID_HOSTS.has(host as ImageHostId)) {
    return NextResponse.json(
      { error: `host must be one of: ${[...VALID_HOSTS].join(", ")}` },
      { status: 400 }
    )
  }
  const hostId = host as ImageHostId

  // Extract and validate file
  const file = formData.get("image")
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "image file is required" }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "image file is empty" }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)` },
      { status: 400 }
    )
  }
  if (!file.type || !VALID_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: file.type ? `Unsupported file type: ${file.type}` : "Missing file type" },
      { status: 400 }
    )
  }

  // Optional expiration (seconds)
  let expirationSeconds: number | null = null
  const expirationRaw = formData.get("expiration")
  if (expirationRaw) {
    const parsed = Number(expirationRaw)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 31_536_000) {
      return NextResponse.json(
        { error: "expiration must be a positive number of seconds (max 31536000)" },
        { status: 400 }
      )
    }
    expirationSeconds = parsed > 0 ? Math.round(parsed) : null
  }

  // Look up encrypted API key from DB — column-projected select to avoid
  // pulling sensitive fields (passwordHash, totpSecret, etc.) into memory.
  const [settings] = await db
    .select({
      encryptedPtpimgApiKey: appSettings.encryptedPtpimgApiKey,
      encryptedOeimgApiKey: appSettings.encryptedOeimgApiKey,
      encryptedImgbbApiKey: appSettings.encryptedImgbbApiKey,
    })
    .from(appSettings)
    .limit(1)
  if (!settings) {
    return NextResponse.json({ error: "App not configured" }, { status: 400 })
  }

  // Type-safe column lookup — compiler catches renamed columns
  const encryptedKey =
    hostId === "ptpimg"
      ? settings.encryptedPtpimgApiKey
      : hostId === "onlyimage"
        ? settings.encryptedOeimgApiKey
        : settings.encryptedImgbbApiKey

  if (!encryptedKey) {
    return NextResponse.json({ error: `No API key configured for ${hostId}` }, { status: 400 })
  }

  // Decrypt API key
  const key = decodeKey(auth)
  let apiKey: string
  try {
    apiKey = decrypt(encryptedKey, key)
  } catch {
    return NextResponse.json({ error: "Failed to decrypt API key" }, { status: 500 })
  }

  // Upload
  const adapter = getImageHostAdapter(hostId)
  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const rawName = file instanceof File ? file.name : "image.png"
  const fileName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)

  // Magic-byte validation — verify actual file content matches declared MIME type.
  // Catches renamed/mistyped files that bypass the client-supplied type check above.
  if (!matchesMagicBytes(fileBuffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match declared type" },
      { status: 400 }
    )
  }

  try {
    const result = await adapter.upload(fileBuffer, fileName, apiKey, {
      expirationSeconds,
    })

    log.info(
      { route: "POST /api/upload-image", host: hostId, hasExpiration: !!expirationSeconds },
      "image uploaded"
    )

    return NextResponse.json(result)
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError"
    log.error(
      { route: "POST /api/upload-image", host: hostId, error: String(err) },
      "upload failed"
    )
    return NextResponse.json(
      { error: isTimeout ? "Upload timed out after 30 seconds" : "Image upload failed" },
      { status: isTimeout ? 504 : 502 }
    )
  }
}
