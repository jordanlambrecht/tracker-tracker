// src/components/ui/DownloadButton.tsx

"use client"

import { useCallback, useState } from "react"
import { CheckLargeIcon, DownloadArrowIcon } from "@/components/ui/Icons"
import { downloadResponseBlob } from "@/lib/download"

interface DownloadButtonProps {
  url: string
  fallbackFilename: string
  label?: string
  onError?: (message: string) => void
  className?: string
}

function DownloadButton({ url, fallbackFilename, label, onError, className }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleDownload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) {
        onError?.(res.status === 404 ? "File not found" : "Download failed")
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
  }, [url, fallbackFilename, onError])

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      aria-label="Download file"
      className={
        className ??
        "flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-sans font-medium text-tertiary hover:text-primary bg-elevated nm-raised-sm rounded-nm-sm transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      }
    >
      {done ? (
        <>
          <CheckLargeIcon width="12" height="12" className="text-success" />
          {label !== undefined ? "Done" : null}
        </>
      ) : (
        <>
          <DownloadArrowIcon width="12" height="12" />
          {label !== undefined ? (loading ? "…" : label) : null}
        </>
      )}
    </button>
  )
}

export type { DownloadButtonProps }
export { DownloadButton }
