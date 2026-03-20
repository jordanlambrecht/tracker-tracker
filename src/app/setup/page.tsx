// src/app/setup/page.tsx

import { connection } from "next/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { SetupForm } from "./SetupForm"

export default async function SetupPage() {
  await connection()

  const [settings] = await db
    .select({ id: appSettings.id })
    .from(appSettings)
    .limit(1)

  if (settings) {
    redirect("/login")
  }

  return <SetupForm />
}
