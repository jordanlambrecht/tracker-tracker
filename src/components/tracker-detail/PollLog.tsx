// src/components/tracker-detail/PollLog.tsx
"use client"

import clsx from "clsx"
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { formatBytesFromString, formatDateTime, formatRatioDisplay } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"

interface PollLogProps {
  snapshots: Snapshot[]
  lastPolledAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  userPausedAt?: string | null
}

export function PollLog({
  snapshots,
  lastPolledAt,
  lastError,
  lastErrorAt,
  userPausedAt,
}: PollLogProps) {
  const [open, setOpen] = useState(false)

  const lastPolledLabel = lastPolledAt ? formatDateTime(lastPolledAt) : "Never"

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="minimal"
        size="sm"
        leftIcon={<ChevronToggle expanded={open} />}
        className="w-fit"
        onClick={() => setOpen((o) => !o)}
        text={`Last polled: ${lastPolledLabel}`}
      />
      {open && (
        <div className="nm-inset-sm bg-control-bg overflow-hidden overflow-x-auto styled-scrollbar rounded-nm-md">
          {userPausedAt && (
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-warn border-b border-border whitespace-nowrap min-w-fit">
              <span className="shrink-0">⏸</span>
              <span className="text-tertiary shrink-0 w-40">{formatDateTime(userPausedAt)}</span>
              <span>Polling paused</span>
            </div>
          )}
          {lastError && !userPausedAt && (
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-mono text-danger border-b border-border whitespace-nowrap min-w-fit">
              <span className="shrink-0">✕</span>
              <span className="text-tertiary shrink-0 w-40">
                {lastErrorAt ? formatDateTime(lastErrorAt) : lastPolledLabel}
              </span>
              <span className="truncate">{lastError}</span>
            </div>
          )}
          {snapshots.length === 0 ? (
            <p className="px-4 py-3 text-xs font-mono text-muted">No poll history yet.</p>
          ) : (
            snapshots
              .slice(-10)
              .reverse()
              .map((snap, i) => (
                <div
                  key={snap.polledAt}
                  className={clsx(
                    "flex items-center gap-4 px-4 py-2 text-xs font-mono whitespace-nowrap min-w-fit",
                    i % 2 === 0 ? "" : "bg-elevated"
                  )}
                >
                  <span className="text-success shrink-0">✓</span>
                  <span className="text-tertiary shrink-0 w-40">
                    {formatDateTime(snap.polledAt)}
                  </span>
                  <span className="text-secondary">
                    {formatBytesFromString(snap.uploadedBytes)} ↑
                  </span>
                  <span className="text-secondary">
                    {formatBytesFromString(snap.downloadedBytes)} ↓
                  </span>
                  <span className="text-secondary">{formatRatioDisplay(snap.ratio)}</span>
                  {snap.isManual && (
                    <span className="text-accent/60 text-[10px] uppercase tracking-wider">
                      Manual
                    </span>
                  )}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  )
}
