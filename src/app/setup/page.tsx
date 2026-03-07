// src/app/setup/page.tsx
"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useState } from "react"
import { Button, Card, Input } from "@/components/ui"

export default function SetupPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const setupRes = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!setupRes.ok) {
        const data = (await setupRes.json()) as { error?: string }
        setError(data.error ?? "Setup failed. Please try again.")
        return
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!loginRes.ok) {
        const data = (await loginRes.json()) as { error?: string }
        setError(data.error ?? "Login after setup failed. Please go to the login page.")
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
            Create a master password to encrypt your API tokens. This password
            is never stored in plain text.
          </p>
        </div>

        <Card elevation="elevated" className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Master Password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={
                error?.toLowerCase().includes("8 char") ? error : undefined
              }
              disabled={isSubmitting}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={
                error?.toLowerCase().includes("match") ? error : undefined
              }
              disabled={isSubmitting}
              required
            />

            {error &&
              !error?.toLowerCase().includes("8 char") &&
              !error?.toLowerCase().includes("match") && (
                <p className="text-xs font-sans text-danger" role="alert">
                  {error}
                </p>
              )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Setting up…" : "Create Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
