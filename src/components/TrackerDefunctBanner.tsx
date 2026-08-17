// src/components/TrackerDefunctBanner.tsx
"use client"

import { ExternalLinkSmallIcon, TriangleWarningIcon } from "@icons"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button, Card, Notice } from "@/components/ui"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { formatJoinedDate } from "@/lib/formatters"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

/**
 * A defunct tracker is one the registry records as permanently shut down — not
 * one that is merely unreachable. That distinction is why `defunct` lives on the
 * registry entry and not in `platformMeta`: adapter metadata is fetched live
 * from the tracker's own API, and a dead tracker has no API left to answer.
 *
 * The one component serves both render sites so the archive mutation exists
 * once: `variant="full"` on the tracker detail page (below the header, above the
 * pause/error banners), `variant="compact"` in the dashboard's card grid.
 */
interface TrackerDefunctBannerProps {
  /** Registry row for this tracker; `undefined` for a tracker with no registry match. */
  registryEntry: TrackerRegistryEntry | undefined
  tracker: Pick<TrackerSummary, "id" | "name" | "isActive">
  variant?: "full" | "compact"
  /** Receives the PATCH response, exactly like TrackerSettingsSheet's `onUpdated`. */
  onArchived?: (updated: TrackerSummary) => void
}

/**
 * Hook-free gate. Every tracker card in the dashboard grid renders one of these
 * and all but the rare defunct one renders nothing — so the state and the
 * QueryClient subscription live in the body below, and a live tracker mounts
 * neither. Doing the check inside the body instead would make a QueryClient a
 * hard requirement for merely displaying the grid.
 */
function TrackerDefunctBanner({ registryEntry, ...rest }: TrackerDefunctBannerProps) {
  if (!registryEntry?.defunct) return null
  return <DefunctBannerBody registryEntry={registryEntry} {...rest} />
}

function DefunctBannerBody({
  registryEntry,
  tracker,
  variant = "full",
  onArchived,
}: TrackerDefunctBannerProps & { registryEntry: TrackerRegistryEntry }) {
  const queryClient = useQueryClient()
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Deliberately the same contract as TrackerSettingsSheet.handleArchive:
   * PATCH the tracker with an `isActive` boolean, then write the returned row
   * through the shared ["trackers"] cache and invalidate it. That cache backs
   * the sidebar and the dashboard, neither of which is remounted by navigating,
   * and its only automatic repair is a poll interval measured in tens of
   * minutes — so skipping the write-through here would reproduce exactly the
   * staleness bug the sheet was just fixed for.
   *
   * Unlike the sheet this sends `isActive: false` rather than a toggle: the
   * button is only offered on a tracker that is still active, so there is no
   * un-archive case to express and no stale-prop race to lose.
   *
   * Worth knowing: the sheet and this banner are now the two callers of the same
   * archive contract, so a shared mutation hook would be the natural next step.
   * It is deliberately not extracted here, because doing so would mean rewriting
   * the sheet's archive path while its own fix is still landing.
   */
  async function handleArchiveNow() {
    setArchiving(true)
    setError(null)
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? "Failed to archive tracker")
        return
      }

      const updated = (await res.json()) as TrackerSummary
      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) =>
        prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev
      )
      // Not awaited: the refetch confirms the row already written through above,
      // and awaiting it would delay the caller's redirect for a full round trip.
      queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
      onArchived?.(updated)
    } catch {
      setError("Network error while archiving")
    } finally {
      setArchiving(false)
    }
  }

  // Authored as "YYYY-MM-DD" precisely so this renders as "May 11, 2026" with no
  // bespoke formatting and no timezone slip (formatJoinedDate parses at local midnight).
  const shutdownDate = formatJoinedDate(registryEntry.defunctDate ?? null)
  // `||`, not `??`: the validator rejects an empty defunctMessage on a non-draft
  // entry, but a draft skips validation entirely, and a blank paragraph under a
  // "Tracker Defunct" heading is worse than a generic sentence.
  const message = registryEntry.defunctMessage?.trim() || `${tracker.name} has shut down.`
  const link = registryEntry.defunctLink?.trim()
  // Offering "Archive Now?" on an already-archived tracker would be an action
  // that does nothing, so it is not rendered at all rather than disabled.
  const canArchive = tracker.isActive

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 pb-3">
        <span className="flex items-center gap-1.5 font-mono text-3xs uppercase tracking-wider text-danger">
          <TriangleWarningIcon width="10" height="10" className="shrink-0" />
          Defunct
          {shutdownDate ? ` · ${shutdownDate}` : ""}
        </span>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-mono text-3xs text-accent hover:underline"
          >
            Details
            <ExternalLinkSmallIcon width="9" height="9" className="shrink-0" />
          </a>
        )}
        {canArchive && (
          <Button
            variant="danger"
            size="sm"
            className="ml-auto"
            onClick={handleArchiveNow}
            loading={archiving}
            text="Archive Now?"
          />
        )}
        {error && <Notice variant="danger" message={error} className="w-full" />}
      </div>
    )
  }

  return (
    <Card glow glowColor="var(--color-danger-dim)" elevation="elevated">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="flex items-center gap-2 text-xs font-sans font-medium text-danger uppercase tracking-wider">
          <TriangleWarningIcon width="14" height="14" className="shrink-0" />
          Tracker Defunct
        </p>
        {shutdownDate && <span className="timestamp shrink-0">{shutdownDate}</span>}
      </div>
      <p className="text-sm font-mono text-secondary mb-3">
        {message}{" "}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Announcement →
          </a>
        )}
      </p>
      {canArchive ? (
        <Button
          variant="danger"
          size="sm"
          onClick={handleArchiveNow}
          loading={archiving}
          text="Archive Now?"
        />
      ) : (
        <p className="text-xs font-mono text-tertiary">
          This tracker is archived. Its history is kept, and it is no longer polled.
        </p>
      )}
      {error && <Notice variant="danger" message={error} className="mt-3" />}
    </Card>
  )
}

export type { TrackerDefunctBannerProps }
export { TrackerDefunctBanner }
