// src/app/login/page.tsx

import { redirect } from "next/navigation"
import { connection } from "next/server"
import { readSession, STALE_SESSION_MESSAGE } from "@/lib/auth"
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

  const session = await readSession()
  if (session?.status === "valid") {
    redirect("/")
  }

  return (
    <LoginForm
      hasUsername={!!settings.username}
      notice={session?.status === "stale" ? STALE_SESSION_MESSAGE : null}
    />
  )
}
