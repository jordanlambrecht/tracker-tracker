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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    if (!username.trim() || username.trim().length < 3) {
      setErrors({ username: "Username must be at least 3 characters." })
      return
    }

    if (password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters." })
      return
    }

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." })
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
        const msg = data.error ?? "Setup failed. Please try again."
        if (msg.toLowerCase().includes("username")) {
          setErrors({ username: msg })
        } else if (msg.toLowerCase().includes("8 char") || msg.toLowerCase().includes("password")) {
          setErrors({ password: msg })
        } else if (msg.toLowerCase().includes("match")) {
          setErrors({ confirmPassword: msg })
        } else {
          setErrors({ form: msg })
        }
        return
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, username: username.trim() }),
      })

      if (!loginRes.ok) {
        const data = (await loginRes.json()) as { error?: string }
        setErrors({ form: data.error ?? "Login after setup failed. Please go to the login page." })
        return
      }

      router.push("/")
    } catch {
      setErrors({ form: "An unexpected error occurred. Please try again." })
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
              error={errors.username}
              disabled={isSubmitting}
            />

            <Input
              label="Master Password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
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
              error={errors.confirmPassword}
              disabled={isSubmitting}
              required
            />

            {errors.form && (
              <p className="text-xs font-sans text-danger" role="alert">
                {errors.form}
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
