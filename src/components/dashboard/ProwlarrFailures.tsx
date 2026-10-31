// src/components/dashboard/ProwlarrFailures.tsx

import Link from "next/link"
import { Notice } from "@/components/ui/Notice"
import { getProwlarrFailures } from "@/lib/prowlarr/status"
import type { TrackerSummary } from "@/types/api"

/** One line for failing indexers and one per Prowlarr instance with an error. Nothing otherwise. */
export function ProwlarrFailures({ trackers }: { trackers: TrackerSummary[] }) {
  const active = trackers.filter((t) => t.isActive)
  const failing = active.flatMap((tracker) =>
    getProwlarrFailures(tracker).map((indexer) => ({ tracker, indexer }))
  )
  const instanceErrors = new Map<number, { name: string; error: string }>()
  for (const tracker of active) {
    for (const indexer of tracker.prowlarr?.indexers ?? []) {
      if (indexer.instanceError) {
        instanceErrors.set(indexer.instanceId, {
          name: indexer.instanceName,
          error: indexer.instanceError,
        })
      }
    }
  }
  if (failing.length === 0 && instanceErrors.size === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {failing.length > 0 && (
        <Notice variant="warn" box header="Failing in Prowlarr">
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {failing.map(({ tracker, indexer }) => (
              <Link
                key={`${tracker.id}-${indexer.instanceId}-${indexer.indexerId}`}
                href={`/trackers/${tracker.id}`}
                className="hover:underline"
              >
                {indexer.name}
                {indexer.name !== tracker.name && (
                  <span className="text-muted"> ({tracker.name})</span>
                )}
              </Link>
            ))}
          </span>
        </Notice>
      )}
      {[...instanceErrors.entries()].map(([id, { name, error }]) => (
        <Notice key={id} variant="danger" box header={name} message={error} />
      ))}
    </div>
  )
}
