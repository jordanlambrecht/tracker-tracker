// src/components/tracker-detail/PollErrorBanner.tsx

import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"

interface PollErrorBannerProps {
  pollError: string | null
  lastError: string | null
  lastPolledAt: string | null
  pausedAt: string | null
  onDismissPollError: () => void
  onResume: () => void
}

export function PollErrorBanner({
  pollError,
  lastError,
  lastPolledAt,
  pausedAt,
  onDismissPollError,
  onResume,
}: PollErrorBannerProps) {
  const showPollError = !!pollError
  const showPaused = !!pausedAt
  const showLastError = !pausedAt && !!lastError

  if (!showPollError && !showPaused && !showLastError) return null

  return (
    <>
      {showPollError && (
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
      {showPaused && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
              Polling Paused
            </p>
            {pausedAt && (
              <span className="text-[10px] font-mono text-muted shrink-0">
                {new Date(pausedAt).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-sm font-mono text-warn mb-2">
            Polling was paused after repeated failures. Verify your API key is correct before
            resuming.
          </p>
          {lastError && (
            <p className="text-xs font-mono text-danger/80 mb-3">Last error: {lastError}</p>
          )}
          <Button variant="danger" size="sm" onClick={onResume}>
            Resume Polling
          </Button>
        </Card>
      )}
      {showLastError && (
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
