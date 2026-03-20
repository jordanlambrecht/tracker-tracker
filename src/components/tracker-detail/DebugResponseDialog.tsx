// src/components/tracker-detail/DebugResponseDialog.tsx

"use client"

import { useEffect, useState } from "react"
import { CopyButton } from "@/components/ui/CopyButton"
import { Dialog } from "@/components/ui/Dialog"
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

  // Reset to raw tab when new data arrives
  useEffect(() => {
    if (data) setActiveTab("raw")
  }, [data])

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

  const content = getActiveContent()
  const hasRawError = !!data?.rawError || (data?.apiCalls?.some((c) => c.error != null) ?? false)
  const isError =
    (activeTab === "raw" && hasRawError) || (activeTab === "normalized" && !!data?.normalizedError)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
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
      }
      ariaLabel="Debug API Response"
      size="md"
      maxWidth="max-w-3xl"
    >
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-secondary text-sm font-mono animate-loading-breathe">
            Fetching API response...
          </p>
        </div>
      )}

      {/* Top-level error (network/auth) */}
      {!loading && error && (
        <div className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-danger text-sm font-mono mb-2">Debug poll failed</p>
            <p className="text-secondary text-xs font-mono">{error}</p>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && data && (
        <div className="flex flex-col gap-0 -m-6">
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

            {content && (
              <CopyButton
                value={content}
                label="Copy"
                className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-sans font-medium text-tertiary hover:text-primary bg-elevated nm-raised-sm rounded-nm-sm transition-colors duration-150 cursor-pointer"
              />
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
