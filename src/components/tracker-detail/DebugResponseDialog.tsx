// src/components/tracker-detail/DebugResponseDialog.tsx
//
// Functions: DebugResponseDialog

"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/Button"
import { CheckLargeIcon, CopyIcon, XIcon } from "@/components/ui/Icons"
import { TabBar } from "@/components/ui/TabBar"
import type { DebugApiCall } from "@/lib/adapters/types"

type DebugTab = "raw" | "normalized"

export interface DebugData {
  apiCalls: DebugApiCall[] | null
  rawError: string | null
  normalized: Record<string, unknown> | null
  normalizedError: string | null
  platform: string
  trackerName: string
}

interface DebugResponseDialogProps {
  open: boolean
  loading: boolean
  data: DebugData | null
  error: string | null
  onClose: () => void
}

const TABS: { key: DebugTab; label: string }[] = [
  { key: "raw", label: "Raw Response" },
  { key: "normalized", label: "Normalized" },
]

export function DebugResponseDialog({
  open,
  loading,
  data,
  error,
  onClose,
}: DebugResponseDialogProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>("raw")
  const [copied, setCopied] = useState(false)

  // Reset to raw tab when new data arrives
  useEffect(() => {
    if (data) setActiveTab("raw")
  }, [data])

  // Trap focus / close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  function getActiveContent(): string {
    if (!data) return ""
    if (activeTab === "raw") {
      if (data.rawError) return `Error: ${data.rawError}`
      if (!data.apiCalls?.length) return "(no API calls recorded)"
      return data.apiCalls
        .map((call) => {
          const header = `── ${call.label} ── ${call.endpoint}`
          if (call.error) return `${header}\nError: ${call.error}`
          return `${header}\n${JSON.stringify(call.data, null, 2)}`
        })
        .join("\n\n")
    }
    if (data.normalizedError) return `Error: ${data.normalizedError}`
    return JSON.stringify(data.normalized, null, 2)
  }

  async function handleCopy() {
    const content = getActiveContent()
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently skip
    }
  }

  const content = getActiveContent()
  const hasRawError =
    !!data?.rawError || (data?.apiCalls?.some((c) => c.error != null) ?? false)
  const isError =
    (activeTab === "raw" && hasRawError) ||
    (activeTab === "normalized" && !!data?.normalizedError)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Debug API Response"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col bg-elevated nm-raised rounded-nm-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-semibold text-primary">
              Debug: {data?.trackerName ?? "Tracker"}
            </span>
            {data?.platform && (
              <span className="text-xs font-mono text-tertiary bg-control-bg px-2 py-0.5 rounded-nm-sm">
                {data.platform}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close debug dialog"
            className="px-2 py-1.5"
          >
            <XIcon width="16" height="16" />
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-secondary text-sm font-mono animate-loading-breathe">
              Fetching API response...
            </p>
          </div>
        )}

        {/* Top-level error (network/auth) */}
        {!loading && error && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-danger text-sm font-mono mb-2">Debug poll failed</p>
              <p className="text-secondary text-xs font-mono">{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Tab bar */}
            <div className="px-5 pt-4 pb-2 shrink-0">
              <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* Code viewer */}
            <div className="relative mx-5 mb-5">
              <div
                className="overflow-y-auto nm-inset rounded-nm-md bg-control-bg"
                style={{ maxHeight: "calc(85vh - 11rem)" }}
              >
                <pre
                  className={[
                    "p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all",
                    isError ? "text-danger" : "text-secondary",
                  ].join(" ")}
                >
                  {content || "(empty response)"}
                </pre>
              </div>

              {/* Copy button — overlaid top-right of the code block */}
              {content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy to clipboard"
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-sans font-medium text-tertiary hover:text-primary bg-elevated nm-raised-sm rounded-nm-sm transition-colors duration-150 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <CheckLargeIcon width="12" height="12" className="text-success" />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon width="12" height="12" />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
