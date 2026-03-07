// src/app/login/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { Button, Card, Input } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? "Login failed. Please try again.")
        return
      }

      router.push("/")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-primary tracking-tight">
            Tracker Tracker
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Enter your master password to unlock.
          </p>
        </div>

        <Card elevation="elevated" className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Master Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error ?? undefined}
              disabled={isSubmitting}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Unlocking…" : "Unlock"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
