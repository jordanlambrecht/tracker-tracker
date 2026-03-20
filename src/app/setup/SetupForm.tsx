// src/app/setup/SetupForm.tsx
"use client"

import { H2 } from "@typography"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { type SubmitEvent, useState } from "react"
import { Button, Card, Input } from "@/components/ui"

export function SetupForm() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!username.trim() || username.trim().length < 3) {
      setError("Username must be at least 3 characters.")
      return
    }

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
      const payload: Record<string, string> = { password, username: username.trim() }

      const setupRes = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!setupRes.ok) {
        const data = (await setupRes.json()) as { error?: string }
        setError(data.error ?? "Setup failed. Please try again.")
        return
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username: username.trim() }),
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
          <Image
            src="/img/trackerTracker_logo.svg"
            alt="Tracker Tracker"
            width={160}
            height={40}
            className="h-10 w-auto mx-auto"
            priority
          />
          <H2 className="mt-6 text-secondary text-center">Create an account</H2>
        </div>

        <Card elevation="elevated" className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="Min. 3 characters"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={error?.toLowerCase().includes("username") ? error : undefined}
              disabled={isSubmitting}
            />

            <Input
              label="Master Password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error?.toLowerCase().includes("8 char") ? error : undefined}
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
              error={error?.toLowerCase().includes("match") ? error : undefined}
              disabled={isSubmitting}
              required
            />

            {error &&
              !error?.toLowerCase().includes("8 char") &&
              !error?.toLowerCase().includes("match") &&
              !error?.toLowerCase().includes("username") && (
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
              {isSubmitting ? "Setting up…" : "Create Account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
