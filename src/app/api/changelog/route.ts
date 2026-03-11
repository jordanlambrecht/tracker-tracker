// src/app/api/changelog/route.ts
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const content = await readFile(join(process.cwd(), "CHANGELOG.md"), "utf-8")
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ content: "No changelog available." })
  }
}
