// src/app/api/settings/image-hosts/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [settings] = await db
    .select({
      encryptedPtpimgApiKey: appSettings.encryptedPtpimgApiKey,
      encryptedOeimgApiKey: appSettings.encryptedOeimgApiKey,
      encryptedImgbbApiKey: appSettings.encryptedImgbbApiKey,
    })
    .from(appSettings)
    .limit(1)

  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  return NextResponse.json({
    ptpimg: !!settings.encryptedPtpimgApiKey,
    onlyimage: !!settings.encryptedOeimgApiKey,
    imgbb: !!settings.encryptedImgbbApiKey,
  })
}
