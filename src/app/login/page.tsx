// src/app/login/page.tsx

import { connection } from "next/server"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { LoginForm } from "./LoginForm"

export default async function LoginPage() {
  await connection()

  const [settings] = await db
    .select({ id: appSettings.id, username: appSettings.username })
    .from(appSettings)
    .limit(1)

  if (!settings) {
    redirect("/setup")
  }

  const session = await getSession()
  if (session) {
    redirect("/")
  }

  return <LoginForm hasUsername={!!settings.username} />
}
