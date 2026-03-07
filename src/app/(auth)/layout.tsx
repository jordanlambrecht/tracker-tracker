// src/app/(auth)/layout.tsx
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    redirect("/setup")
  }

  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
