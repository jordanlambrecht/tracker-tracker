// src/components/TwoFactorSetup.tsx
//
// Functions: TwoFactorSetup

"use client"

import { H3, Paragraph, Subtext } from "@typography"
import { QRCodeSVG } from "qrcode.react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Checkbox } from "@/components/ui/Checkbox"
import { Input } from "@/components/ui/Input"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TotpStep =
  | "idle"
  | "loading-setup"
  | "qr-code"
  | "confirming"
  | "backup-codes"
  | "enabled"
  | "disable-prompt"
  | "disabling"

interface SetupData {
  qrCodeUri: string
  secret: string
  setupToken: string
}

interface SetupApiResponse {
  uri: string
  setupToken: string
  backupCodes: string[]
}

interface ApiError {
  error?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TwoFactorSetup() {
  const [step, setStep] = useState<TotpStep>("idle")
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [totpCode, setTotpCode] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [disablePassword, setDisablePassword] = useState("")
  const [enableBackupCodes, setEnableBackupCodes] = useState(true)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Check initial 2FA status
  useEffect(() => {
    let cancelled = false
    async function checkStatus() {
      try {
        const res = await fetch("/api/auth/status")
        if (!res.ok) return
        const data: { totpEnabled?: boolean } = await res.json()
        if (data.totpEnabled) {
          if (!cancelled) setStep("enabled")
        }
      } catch {
        // Endpoint may not exist yet — default to idle
      }
    }
    checkStatus()
    return () => {
      cancelled = true
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleStartSetup = useCallback(async () => {
    setStep("loading-setup")
    setError(null)
    setTotpCode("")

    try {
      const res = await fetch("/api/auth/totp/setup", { method: "POST" })
      const data: SetupApiResponse & ApiError = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Setup failed")
        setStep("idle")
        return
      }

      const secretMatch = data.uri.match(/secret=([A-Z2-7]+)/i)
      setSetupData({
        qrCodeUri: data.uri,
        secret: secretMatch?.[1] ?? "",
        setupToken: data.setupToken,
      })
      setBackupCodes(data.backupCodes)
      setStep("qr-code")
    } catch {
      setError("Network error — could not reach the server")
      setStep("idle")
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    if (totpCode.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app")
      return
    }
    setStep("confirming")
    setError(null)

    try {
      const res = await fetch("/api/auth/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupToken: setupData?.setupToken,
          code: totpCode,
          enableBackupCodes,
        }),
      })
      const data: ApiError = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Verification failed")
        setStep("qr-code")
        return
      }
    } catch {
      setError("Network error — could not reach the server")
      setStep("qr-code")
      return
    }

    if (enableBackupCodes && backupCodes.length > 0) {
      setSetupData(null) // Clear TOTP secret from memory
      setStep("backup-codes")
    } else {
      setSetupData(null)
      setStep("enabled")
    }
  }, [totpCode, setupData, enableBackupCodes, backupCodes.length])

  const handleDisable = useCallback(async () => {
    const code = disableCode.trim()
    if (!disablePassword) {
      setError("Enter your master password")
      return
    }
    if (!code) {
      setError("Enter your authenticator code")
      return
    }

    setStep("disabling")
    setError(null)

    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, isBackupCode: useBackupCode, password: disablePassword }),
      })
      const data: ApiError = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Invalid code")
        setStep("disable-prompt")
        return
      }
    } catch {
      setError("Network error — could not reach the server")
      setStep("disable-prompt")
      return
    }

    setStep("idle")
    setDisableCode("")
    setDisablePassword("")
    setUseBackupCode(false)
    setSetupData(null)
    setBackupCodes([])
  }, [disableCode, disablePassword, useBackupCode])

  function handleCopyAll() {
    navigator.clipboard
      .writeText(backupCodes.join("\n"))
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        setError("Copy failed — select the text manually")
      })
  }

  function handleCopySecret() {
    if (!setupData) return
    navigator.clipboard
      .writeText(setupData.secret)
      .then(() => {
        setCopiedSecret(true)
        setTimeout(() => setCopiedSecret(false), 2000)
      })
      .catch(() => {
        setError("Copy failed — select the text manually")
      })
  }

  function handleCancel() {
    setStep("idle")
    setTotpCode("")
    setError(null)
    setSetupData(null)
    setBackupCodes([])
  }

  function handleCancelDisable() {
    setStep("enabled")
    setDisableCode("")
    setDisablePassword("")
    setError(null)
    setUseBackupCode(false)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {step === "enabled" && (
        <div className="flex items-center gap-3">
          <Badge variant="success">Enabled</Badge>
        </div>
      )}

      {/* ── State: Idle (not enrolled) ─────────────────────────── */}
      {step === "idle" && (
        <>
          <Paragraph>
            Add a second layer of security to your login. You&apos;ll need an authenticator app like
            Google Authenticator, Authy, or 1Password.
          </Paragraph>
          {error && (
            <p className="text-xs font-sans text-danger" role="alert">
              {error}
            </p>
          )}
          <div>
            <Button size="sm" onClick={handleStartSetup}>
              Enable 2FA
            </Button>
          </div>
        </>
      )}

      {/* ── State: Loading setup ───────────────────────────────── */}
      {step === "loading-setup" && (
        <p className="text-sm font-mono text-tertiary">Generating secret...</p>
      )}

      {/* ── State: QR Code + verify ────────────────────────────── */}
      {(step === "qr-code" || step === "confirming") && setupData && (
        <div className="nm-inset-sm p-5 flex flex-col gap-5 rounded-nm-md">
          {/* QR code on white background */}
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white inline-flex rounded-nm-md">
              <QRCodeSVG
                value={setupData.qrCodeUri}
                size={180}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Manual entry fallback */}
            <div className="flex flex-col items-center gap-2 w-full">
              <Subtext className="text-center">Can&apos;t scan? Enter this code manually:</Subtext>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-primary bg-control-bg nm-inset-sm px-3 py-2 tracking-wider select-all rounded-nm-sm">
                  {setupData.secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="text-xs font-sans text-tertiary hover:text-primary transition-colors cursor-pointer"
                >
                  {copiedSecret ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Backup codes option */}
          <Checkbox
            checked={enableBackupCodes}
            onChange={setEnableBackupCodes}
            label="Generate backup codes"
          />

          {/* Verification input */}
          <div className="flex flex-col gap-2">
            <Input
              label="Authenticator Code"
              value={totpCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6)
                setTotpCode(v)
                setError(null)
              }}
              placeholder="000000"
              className="text-center tracking-[0.3em]"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              error={error ?? undefined}
            />
            <Subtext>Enter the 6-digit code from your authenticator app to confirm setup.</Subtext>
          </div>

          <div className="flex gap-3">
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={step === "confirming" || totpCode.length !== 6}
            >
              {step === "confirming" ? "Verifying..." : "Confirm"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── State: Backup codes ────────────────────────────────── */}
      {step === "backup-codes" && (
        <div className="nm-inset-sm p-5 flex flex-col gap-4 rounded-nm-md">
          <H3>Backup Codes</H3>

          <div className="grid grid-cols-2 gap-2 nm-inset-sm p-4 rounded-nm-sm">
            {backupCodes.map((code) => (
              <span
                key={code}
                className="font-mono text-sm text-primary tabular-nums text-center py-1"
              >
                {code}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" variant="secondary" onClick={handleCopyAll}>
              {copied ? "Copied" : "Copy All"}
            </Button>
          </div>

          <p className="text-xs font-sans leading-relaxed text-warn">
            Save these codes somewhere safe. Each code can only be used once. You won&apos;t be able
            to see them again.
          </p>

          <div>
            <Button
              size="sm"
              onClick={() => {
                setStep("enabled")
                setBackupCodes([])
                setSetupData(null)
              }}
            >
              I&apos;ve saved my codes
            </Button>
          </div>
        </div>
      )}

      {/* ── State: Enabled ─────────────────────────────────────── */}
      {step === "enabled" && (
        <>
          <Paragraph>
            Your account is protected with two-factor authentication. You&apos;ll need your
            authenticator app each time you log in.
          </Paragraph>
          <div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setStep("disable-prompt")
                setDisableCode("")
                setDisablePassword("")
                setError(null)
                setUseBackupCode(false)
              }}
            >
              Disable 2FA
            </Button>
          </div>
        </>
      )}

      {/* ── State: Disable prompt ──────────────────────────────── */}
      {(step === "disable-prompt" || step === "disabling") && (
        <div className="nm-inset-sm p-4 flex flex-col gap-3 rounded-nm-md bg-danger-dim">
          <Input
            label="Master Password"
            type="password"
            value={disablePassword}
            onChange={(e) => {
              setDisablePassword(e.target.value)
              setError(null)
            }}
            placeholder="Enter your master password"
            autoComplete="current-password"
          />

          {useBackupCode ? (
            <Input
              label="Backup Code"
              value={disableCode}
              onChange={(e) => {
                setDisableCode(e.target.value)
                setError(null)
              }}
              placeholder="a1b2-c3d4"
              className="font-mono tracking-wider"
              error={error ?? undefined}
            />
          ) : (
            <Input
              label="Authenticator Code"
              value={disableCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6)
                setDisableCode(v)
                setError(null)
              }}
              placeholder="000000"
              className="text-center tracking-[0.3em]"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              error={error ?? undefined}
            />
          )}

          <Paragraph>
            {useBackupCode
              ? "Enter one of your backup codes to disable 2FA."
              : "Enter your authenticator code to disable two-factor authentication."}
          </Paragraph>

          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="danger"
              onClick={handleDisable}
              disabled={step === "disabling" || !disableCode.trim() || !disablePassword.trim()}
            >
              {step === "disabling" ? "Disabling..." : "Confirm Disable"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelDisable}>
              Cancel
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode)
              setDisableCode("")
              setError(null)
            }}
            className="text-xs font-sans text-tertiary hover:text-secondary transition-colors cursor-pointer self-start"
          >
            {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
          </button>
        </div>
      )}
    </div>
  )
}

export { TwoFactorSetup }
