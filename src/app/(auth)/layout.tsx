// src/app/(auth)/layout.tsx

import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AuthShell } from "@/components/layout/AuthShell"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { ensureSchedulerRunning } from "@/lib/scheduler"

export default async function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    redirect("/setup")
  }

  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  // Auto-restart scheduler if it died (i.e, server restart).
  ensureSchedulerRunning(session.encryptionKey)

  return <AuthShell>{children}</AuthShell>
}
