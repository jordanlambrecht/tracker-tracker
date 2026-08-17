// src/app/(auth)/layout.tsx

import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { UsernamePrompt } from "@/components/auth/UsernamePromptDialog"
import { AuthShell } from "@/components/layout/AuthShell"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { ensureSchedulerRunning } from "@/lib/scheduler"
import { QueryProvider } from "./QueryProvider"

export const dynamic = "force-dynamic"

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // `username` rides along on a query this layout already runs, so the
  // "set a username" prompt costs no extra round-trip and needs no client fetch.
  const [[settings], session] = await Promise.all([
    db.select({ id: appSettings.id, username: appSettings.username }).from(appSettings).limit(1),
    getSession(),
  ])

  if (!settings) redirect("/setup")
  if (!session) redirect("/login")

  // Auto-restart scheduler if it died (i.e. server restart).
  try {
    ensureSchedulerRunning(session.encryptionKey)
  } catch (err) {
    console.error("[auth-layout] Scheduler startup failed:", err)
  }

  return (
    <QueryProvider>
      {/* Mounted at the layout, not on the dashboard: the dashboard swaps itself
          for an empty state when no trackers exist, which is exactly the
          fresh-install first login this prompt is for. Renders nothing once a
          username is set. Both redirects above have already run, so reaching
          this line means a full session — a TOTP leg still pending holds only a
          pending token and was sent to /login. */}
      <UsernamePrompt needed={!settings.username} />
      <AuthShell>{children}</AuthShell>
    </QueryProvider>
  )
}
