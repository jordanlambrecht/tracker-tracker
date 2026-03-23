// src/app/setup/page.tsx

import { redirect } from "next/navigation"
import { connection } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { SetupForm } from "./SetupForm"

export default async function SetupPage() {
  await connection()

  const [settings] = await db.select({ id: appSettings.id }).from(appSettings).limit(1)

  if (settings) {
    redirect("/login")
  }

  return <SetupForm />
}
