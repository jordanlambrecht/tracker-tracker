// src/components/tracker-detail/TrackerStatusBanner.tsx

import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { DOCS } from "@/lib/constants"
import { getPauseState } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

interface TrackerStatusBannerProps {
  tracker: TrackerSummary
  pollError: string | null
  onDismissPollError: () => void
  onResume: () => void
}

export function TrackerStatusBanner({
  tracker,
  pollError,
  onDismissPollError,
  onResume,
}: TrackerStatusBannerProps) {
  const pause = getPauseState(tracker)

  const showPollError = !!pollError
  const showUserPaused = !pollError && pause.isPaused && pause.reason === "user"
  const showAutoPaused = !pollError && pause.isPaused && pause.reason === "failure"
  const showLastError = !pollError && !pause.isPaused && !!tracker.lastError

  if (!showPollError && !showUserPaused && !showAutoPaused && !showLastError) return null

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
      {showUserPaused && pause.isPaused && pause.reason === "user" && (
        <Card glow glowColor="var(--color-warn-dim)" elevation="elevated">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-sans font-medium text-warn uppercase tracking-wider">
              Polling Paused
            </p>
            <span className="timestamp shrink-0">since {pause.since.toLocaleDateString()}</span>
          </div>
          <p className="text-sm font-mono text-secondary mt-2">
            Automated polling is paused by the user.
          </p>
        </Card>
      )}
      {showAutoPaused && pause.isPaused && pause.reason === "failure" && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
              Polling Paused
            </p>
            <span className="timestamp shrink-0">{new Date(pause.since).toLocaleString()}</span>
          </div>
          <p className="text-sm font-mono text-warn mb-2">
            Polling was paused after repeated failures. Verify your API key is correct before
            resuming.{" "}
            <a
              href={DOCS.TRACKER_OFFLINE.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Troubleshooting guide →
            </a>
          </p>
          {tracker.lastError && (
            <p className="text-xs font-mono text-danger/80 mb-3">Last error: {tracker.lastError}</p>
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
            {tracker.lastPolledAt && (
              <span className="timestamp">{new Date(tracker.lastPolledAt).toLocaleString()}</span>
            )}
          </div>
          <p className="text-danger text-sm font-mono">{tracker.lastError}</p>
        </Card>
      )}
    </>
  )
}
