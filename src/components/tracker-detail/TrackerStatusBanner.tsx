// src/components/tracker-detail/TrackerStatusBanner.tsx

import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { DOCS } from "@/lib/constants"
import { formatDateTime } from "@/lib/formatters"
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

  // An archived tracker is not polled at all, the poll cycle selects on
  // `isActive = true` (tracker-scheduler.ts), so a pause banner announces a
  // state that does not apply, and "Resume Polling" offers an action that
  // cannot deliver what it says: the resume route clears pausedAt, lastError
  // and consecutiveFailures without touching isActive, so the tracker stays
  // off the rotation and the button reads as broken.
  //
  // Nothing is rendered in the pause banner's place. Archiving is the user's
  // own deliberate choice rather than a fault needing explanation, and it is
  // already stated twice on this page: the detail header carries an "Archived"
  // badge, and a defunct tracker's own banner (which sits above this one)
  // says its history is kept and it is no longer polled. A third notice would
  // only repeat them.
  const isArchived = !tracker.isActive

  const showPollError = !!pollError
  const showUserPaused = !pollError && !isArchived && pause.isPaused && pause.reason === "user"
  const showAutoPaused = !pollError && !isArchived && pause.isPaused && pause.reason === "failure"
  // Gated on the pause banners rather than on `pause.isPaused` directly. For an
  // active tracker the two are identical, but an archived tracker that was
  // auto-paused before archiving carries both a pausedAt and a lastError, and
  // suppressing its pause banner must not take the page's only copy of that
  // error with it. The error is a timestamped record of what the last poll
  // returned, not a claim about a poll that is still scheduled, so archiving
  // does not retire it.
  const showLastError = !pollError && !showUserPaused && !showAutoPaused && !!tracker.lastError

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
            <span className="timestamp shrink-0">{formatDateTime(pause.since)}</span>
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
          <Button variant="danger" size="sm" onClick={onResume} text="Resume Polling" />
        </Card>
      )}
      {showLastError && (
        <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
              Last Error
            </p>
            {tracker.lastPolledAt && (
              <span className="timestamp">{formatDateTime(tracker.lastPolledAt)}</span>
            )}
          </div>
          <p className="text-danger text-sm font-mono">{tracker.lastError}</p>
        </Card>
      )}
    </>
  )
}
