// src/app/api/settings/db-size/route.ts

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { getDbSizeHistory } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const data = await getDbSizeHistory()
  return NextResponse.json(data)
}
