// src/components/tracker-detail/TrackerStatusBanner.tsx
"use client"

import { useState } from "react"
import { LinkTrackerDialog } from "@/components/tracker-detail/LinkTrackerDialog"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { ConfirmRemove } from "@/components/ui/ConfirmRemove"
import { Notice } from "@/components/ui/Notice"
import { registryHostname } from "@/data/tracker-registry"
import { useHeldTrackerSlugs } from "@/hooks/useHeldTrackerSlugs"
import { useTrackerArchiveDelete } from "@/hooks/useTrackerArchiveDelete"
import { DOCS } from "@/lib/constants"
import { formatDateTime } from "@/lib/formatters"
import { canLink, getPauseState } from "@/lib/tracker-status"
import type { TrackerSummary } from "@/types/api"

interface TrackerStatusBannerProps {
  tracker: TrackerSummary
  pollError: string | null
  onDismissPollError: () => void
  onResume: () => void
  /** Receives the PATCH response from the unlinked card's Archive. */
  onArchived: (updated: TrackerSummary) => void
  /** Receives the linked row from the unlinked card's Link. */
  onLinked: (updated: TrackerSummary) => void
  onDeleted: () => void
}

export function TrackerStatusBanner({
  tracker,
  pollError,
  onDismissPollError,
  onResume,
  onArchived,
  onLinked,
  onDeleted,
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
  // An unlinked row can't be polled or resumed, so its card replaces both pause
  // cards. That includes a user pause, which isn't why the row sits idle.
  const showUnlinked = !pollError && !isArchived && !tracker.linked
  const showUserPaused =
    !pollError && !isArchived && tracker.linked && pause.isPaused && pause.reason === "user"
  const showAutoPaused =
    !pollError && !isArchived && tracker.linked && pause.isPaused && pause.reason === "failure"
  // Gated on the pause banners rather than on `pause.isPaused` directly. For an
  // active tracker the two are identical, but an archived tracker that was
  // auto-paused before archiving carries both a pausedAt and a lastError, and
  // suppressing its pause banner must not take the page's only copy of that
  // error with it. The error is a timestamped record of what the last poll
  // returned, not a claim about a poll that is still scheduled, so archiving
  // does not retire it.
  // The unlinked card carries no error line. Its reason is the whole story, and
  // the poll log still shows the last error.
  const showLastError =
    !pollError && !showUnlinked && !showUserPaused && !showAutoPaused && !!tracker.lastError

  if (!showPollError && !showUnlinked && !showUserPaused && !showAutoPaused && !showLastError) {
    return null
  }

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
      {showUnlinked && (
        <UnlinkedCard
          tracker={tracker}
          onArchived={onArchived}
          onLinked={onLinked}
          onDeleted={onDeleted}
        />
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

// Its own component so the QueryClient its hooks need is only a requirement
// where the card renders.
function UnlinkedCard({
  tracker,
  onArchived,
  onLinked,
  onDeleted,
}: Pick<TrackerStatusBannerProps, "tracker" | "onArchived" | "onLinked" | "onDeleted">) {
  const { archiving, deleting, error, setActive, remove, syncTrackerCache } =
    useTrackerArchiveDelete(tracker.id)
  const [linking, setLinking] = useState(false)
  const heldSlugs = useHeldTrackerSlugs({ enabled: linking })
  // The stored address is the only one an unlinked row has. The sentence drops
  // when it won't parse, as in the poll's pause message.
  const host = registryHostname(tracker.baseUrl)
  // A duplicate belongs to a tracker another row already uses, so it can't be
  // linked, only archived or deleted.
  const duplicateOf = tracker.duplicateOf
  const linkable = canLink(tracker)

  async function handleArchive() {
    const updated = await setActive(false)
    if (updated) onArchived(updated)
  }

  async function handleDelete() {
    if (await remove()) onDeleted()
  }

  function handleLinked(updated: TrackerSummary) {
    syncTrackerCache(updated)
    setLinking(false)
    onLinked(updated)
  }

  return (
    <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
      <p className="text-xs font-sans font-medium text-danger uppercase tracking-wider mb-2">
        {duplicateOf ? "Already tracked" : "Not in the tracker list"}
      </p>
      <p className="text-sm font-mono text-secondary mb-3">
        {duplicateOf ? (
          `Another of your trackers already uses ${duplicateOf}. Archive this one to keep its history, or delete it.`
        ) : (
          <>
            This tracker isn't in the tracker list, so it isn't polled.
            {host && ` It was set up for ${host}.`}{" "}
            {linkable
              ? "Link it to a tracker in the list, archive it to keep its history, or delete it."
              : "Archive it to keep its history, or delete it."}
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {linkable && (
          <Button
            size="sm"
            onClick={() => setLinking(true)}
            disabled={archiving || deleting}
            text="Link to a tracker"
          />
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleArchive}
          loading={archiving}
          disabled={deleting}
          text="Archive"
        />
        <ConfirmRemove
          label="Delete"
          confirmLabel="Confirm Delete"
          busyLabel="Deleting..."
          busy={deleting}
          onConfirm={handleDelete}
        />
      </div>
      {error && <Notice variant="danger" message={error} className="mt-3" />}
      {linkable && (
        <LinkTrackerDialog
          open={linking}
          onClose={() => setLinking(false)}
          trackerId={tracker.id}
          heldSlugs={heldSlugs}
          onLinked={handleLinked}
        />
      )}
    </Card>
  )
}
