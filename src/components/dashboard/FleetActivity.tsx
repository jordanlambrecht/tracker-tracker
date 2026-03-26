// src/components/dashboard/FleetActivity.tsx

"use client"

import type { TodayAtAGlance } from "@/types/api"

interface FleetActivityProps {
  activity: TodayAtAGlance["activity"]
}

export function FleetActivity({ activity }: FleetActivityProps) {
  const { addedToday, completedToday } = activity

  if (addedToday === 0 && completedToday === 0) {
    return <p className="text-sm font-mono text-muted">No fleet activity today</p>
  }

  return (
    <div className="flex items-center gap-3 text-sm font-mono text-secondary">
      <span>
        <span className="text-primary font-semibold">{addedToday}</span>
        {" added today"}
      </span>
      <span className="text-muted">&middot;</span>
      <span>
        <span className="text-primary font-semibold">{completedToday}</span>
        {" completed today"}
      </span>
    </div>
  )
}
