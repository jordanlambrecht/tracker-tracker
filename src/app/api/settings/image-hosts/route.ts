// src/app/api/settings/image-hosts/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { fetchSettings } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [settings] = await fetchSettings()

  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  return NextResponse.json({
    ptpimg: !!settings.hasPtpimgKey,
    onlyimage: !!settings.hasOeimgKey,
    imgbb: !!settings.hasImgbbKey,
  })
}
