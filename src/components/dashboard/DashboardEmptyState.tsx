// src/components/dashboard/DashboardEmptyState.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { H3, Paragraph } from "@typography"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { Button, Card } from "@/components/ui"
import { useHeldTrackerSlugs } from "@/hooks/useHeldTrackerSlugs"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

interface DashboardEmptyStateProps {
  /** Refetches the dashboard queries once the first tracker exists. */
  onAdded: () => void | Promise<void>
}

function hasRows(trackers: TrackerSummary[]): boolean {
  return trackers.length > 0
}

/**
 * Shown on the dashboard when no tracker is active: none added yet, or every one
 * archived. The dashboard's own list holds active trackers only, so this reads the
 * shared tracker list, where any row it finds is archived.
 *
 * The sidebar's "+ Add Tracker" button keeps its dialog state local, and the two
 * components are siblings under AuthShell with nothing shared between them, so this
 * mounts its own AddTrackerDialog rather than reaching for the sidebar's.
 */
function DashboardEmptyState({ onAdded }: DashboardEmptyStateProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const router = useRouter()
  const heldSlugs = useHeldTrackerSlugs()
  const { data: archived = false } = useQuery({ ...trackerQueryOptions, select: hasRows })

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-12">
      <Card elevation="raised" className="flex flex-col items-center gap-4 py-10">
        {archived ? (
          <div className="text-center flex flex-col gap-2">
            <H3>All your trackers are archived</H3>
            <Paragraph>
              Archived trackers aren't polled. Find them under Show Archived in the sidebar and
              reactivate one from its settings, or add a new tracker.
            </Paragraph>
          </div>
        ) : (
          <div className="text-center flex flex-col gap-2">
            <H3>No trackers added yet</H3>
            <Paragraph>
              Add one of your private tracker accounts to start recording ratio, buffer, and rank.
              Stats show up here after the first poll.
            </Paragraph>
          </div>
        )}
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          text={archived ? "Add Tracker" : "Add First Tracker"}
        />
      </Card>

      <AddTrackerDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={(id) => {
          setShowAddDialog(false)
          void onAdded()
          router.push(`/trackers/${id}`)
        }}
        heldSlugs={heldSlugs}
      />
    </div>
  )
}

export { DashboardEmptyState }
