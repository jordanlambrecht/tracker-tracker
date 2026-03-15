// src/app/login/page.tsx
"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useState } from "react"
import { Button, Card, Input } from "@/components/ui"

type LoginStep = "password" | "totp"

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<LoginStep>("password")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showBackupInput, setShowBackupInput] = useState(false)
  const [backupCode, setBackupCode] = useState("")
  const [hasUsername, setHasUsername] = useState(false)
  const [statusLoaded, setStatusLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data: { configured?: boolean; hasUsername?: boolean }) => {
        if (cancelled) return
        if (!data.configured) {
          router.push("/setup")
          return
        }
        setHasUsername(!!data.hasUsername)
        setStatusLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setStatusLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload: Record<string, string> = { password }
      if (hasUsername) payload.username = username

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.")
        return
      }

      if (data.requiresTotp) {
        setPendingToken(data.pendingToken)
        setStep("totp")
        return
      }

      router.push("/")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTotpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const isBackup = showBackupInput
    const codeValue = isBackup ? backupCode : totpCode

    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingToken,
          code: codeValue,
          isBackupCode: isBackup,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Verification failed.")
        return
      }

      router.push("/")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBackToPassword() {
    setStep("password")
    setPendingToken(null)
    setTotpCode("")
    setBackupCode("")
    setError(null)
    setShowBackupInput(false)
  }

  if (!statusLoaded) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-4">
        <p className="text-sm font-mono text-tertiary animate-loading-breathe">Loading...</p>
      </div>
    )
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
          <p className="mt-2 text-sm text-secondary">
            {step === "password"
              ? "Enter your credentials to unlock."
              : "Enter the code from your authenticator app."}
          </p>
        </div>

        <Card elevation="elevated" className="p-6">
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-5">
              {hasUsername && (
                <Input
                  label="Username"
                  type="text"
                  autoComplete="username"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              )}

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
          )}

          {step === "totp" && (
            <form onSubmit={handleTotpSubmit} className="flex flex-col gap-5">
              {!showBackupInput ? (
                <Input
                  label="Authenticator Code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000 000"
                  value={totpCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6)
                    setTotpCode(v)
                  }}
                  error={error ?? undefined}
                  disabled={isSubmitting}
                  className="text-center tracking-[0.3em] font-mono"
                  required
                />
              ) : (
                <Input
                  label="Backup Code"
                  type="text"
                  autoComplete="off"
                  placeholder="XXXX-XXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  error={error ?? undefined}
                  disabled={isSubmitting}
                  className="text-center tracking-[0.15em] font-mono"
                  required
                />
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Verifying…" : "Verify"}
              </Button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBackToPassword}
                  className="text-xs font-sans text-tertiary hover:text-secondary transition-colors cursor-pointer"
                >
                  Back to password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBackupInput(!showBackupInput)
                    setError(null)
                  }}
                  className="text-xs font-sans text-tertiary hover:text-secondary transition-colors cursor-pointer"
                >
                  {showBackupInput ? "Use authenticator" : "Use backup code"}
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
