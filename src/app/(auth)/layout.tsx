// src/app/(auth)/layout.tsx

import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AuthShell } from "@/components/layout/AuthShell"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { ensureSchedulerRunning } from "@/lib/scheduler"
import { QueryProvider } from "./QueryProvider"

export const dynamic = "force-dynamic"

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [[settings], session] = await Promise.all([
    db.select({ id: appSettings.id }).from(appSettings).limit(1),
    getSession(),
  ])

  if (!settings) redirect("/setup")
  if (!session) redirect("/login")

  // Auto-restart scheduler if it died (i.e, server restart).
  ensureSchedulerRunning(session.encryptionKey)

  return (
    <QueryProvider>
      <AuthShell>{children}</AuthShell>
    </QueryProvider>
  )
}
