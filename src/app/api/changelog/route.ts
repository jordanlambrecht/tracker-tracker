// src/app/api/changelog/route.ts
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    let content = await readFile(join(process.cwd(), "CHANGELOG.md"), "utf-8")
    // Strip version header links for dialog display, keep plain text
    content = content.replace(/## \[([^\]]+)\]\([^)]+\)/g, "## $1")
    return NextResponse.json({ content })
  } catch (err) {
    log.warn({ err: errMsg(err) }, "[changelog] Failed to read CHANGELOG.md")
    return NextResponse.json({ content: "No changelog available." })
  }
}
