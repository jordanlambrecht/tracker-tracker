// src/components/dashboard/DashboardEmptyState.tsx
"use client"

import { H3, Paragraph } from "@typography"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { Button, Card } from "@/components/ui"

interface DashboardEmptyStateProps {
  /** Refetches the dashboard queries once the first tracker exists. */
  onAdded: () => void | Promise<void>
}

/**
 * Shown on the dashboard when the account has no trackers at all.
 *
 * The sidebar's "+ Add Tracker" button keeps its dialog state local, and the two
 * components are siblings under AuthShell with nothing shared between them, so this
 * mounts its own AddTrackerDialog rather than reaching for the sidebar's.
 */
function DashboardEmptyState({ onAdded }: DashboardEmptyStateProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto pt-12 pb-12">
      <Card elevation="raised" className="flex flex-col items-center gap-4 py-10">
        <span className="text-2xl" aria-hidden="true">
          📊
        </span>
        <div className="text-center flex flex-col gap-2">
          <H3>No trackers added yet</H3>
          <Paragraph>
            Add one of your private tracker accounts to start recording ratio, buffer, and rank.
            Stats show up here after the first poll.
          </Paragraph>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} text="Add First Tracker" />
      </Card>

      <AddTrackerDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={(id) => {
          setShowAddDialog(false)
          void onAdded()
          router.push(`/trackers/${id}`)
        }}
      />
    </div>
  )
}

export { DashboardEmptyState }
