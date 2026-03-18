// src/components/tracker-detail/PollErrorBanner.tsx

import { Card } from "@/components/ui/Card"

interface PollErrorBannerProps {
  pollError: string | null
  lastError: string | null
  lastPolledAt: string | null
  onDismissPollError: () => void
}

export function PollErrorBanner({
  pollError,
  lastError,
  lastPolledAt,
  onDismissPollError,
}: PollErrorBannerProps) {
  if (!pollError && !lastError) return null

  return (
    <>
      {pollError && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-center justify-between gap-3">
            <p className="text-danger text-sm font-mono">Poll error: {pollError}</p>
            <button
              type="button"
              onClick={onDismissPollError}
              className="text-danger/60 hover:text-danger transition-colors cursor-pointer shrink-0 text-xs p-1 -m-1"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </Card>
      )}
      {lastError && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
              Last Error
            </p>
            {lastPolledAt && (
              <span className="text-[10px] font-mono text-muted">
                {new Date(lastPolledAt).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-danger text-sm font-mono">{lastError}</p>
        </Card>
      )}
    </>
  )
}
