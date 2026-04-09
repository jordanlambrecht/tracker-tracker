// src/components/ui/ActionButtons.tsx
"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/Button"
import { CheckLargeIcon, CopyIcon, DownloadArrowIcon } from "@/components/ui/Icons"
import { downloadResponseBlob } from "@/lib/download"

// ── CopyButton ───────────────────────────────────────────────────────────────

interface CopyButtonProps {
  value: string
  label?: string
  className?: string
}

function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        // clipboard unavailable. silently skip
      })
  }, [value])

  const icon = copied ? (
    <CheckLargeIcon width="12" height="12" className="text-success" />
  ) : (
    <CopyIcon width="12" height="12" />
  )

  const text = label !== undefined ? (copied ? "Copied" : label) : undefined

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      leftIcon={icon}
      text={text}
      className={className}
    />
  )
}

// ── DownloadButton ───────────────────────────────────────────────────────────

interface DownloadButtonProps {
  url: string
  fallbackFilename: string
  label?: string
  notFoundMessage?: string
  onError?: (message: string) => void
  className?: string
}

function DownloadButton({
  url,
  fallbackFilename,
  label,
  notFoundMessage = "File not found",
  onError,
  className,
}: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleDownload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        onError?.(res.status === 404 ? notFoundMessage : "Download failed")
        return
      }
      await downloadResponseBlob(res, fallbackFilename)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      onError?.("Download failed")
    } finally {
      setLoading(false)
    }
  }, [url, fallbackFilename, notFoundMessage, onError])

  const icon = done ? (
    <CheckLargeIcon width="12" height="12" className="text-success" />
  ) : (
    <DownloadArrowIcon width="12" height="12" />
  )

  const text = label !== undefined ? (done ? "Done" : loading ? "…" : label) : undefined

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      aria-label="Download file"
      leftIcon={icon}
      text={text}
      className={className}
    />
  )
}

export type { CopyButtonProps, DownloadButtonProps }
export { CopyButton, DownloadButton }
