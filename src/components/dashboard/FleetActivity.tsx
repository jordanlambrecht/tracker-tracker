// src/components/dashboard/FleetActivity.tsx

"use client"

import type { GlanceDay, TodayAtAGlance } from "@/types/api"

interface FleetActivityProps {
  activity: TodayAtAGlance["activity"]
  day?: GlanceDay
}

export function FleetActivity({ activity, day = "today" }: FleetActivityProps) {
  const { addedToday, completedToday } = activity

  if (addedToday === 0 && completedToday === 0) {
    return <p className="text-sm font-mono text-muted">No fleet activity {day}</p>
  }

  return (
    <div className="flex items-center gap-3 text-sm font-mono text-secondary">
      <span>
        <span className="text-primary font-semibold">{addedToday}</span>
        {` added ${day}`}
      </span>
      <span className="text-muted">&middot;</span>
      <span>
        <span className="text-primary font-semibold">{completedToday}</span>
        {` completed ${day}`}
      </span>
    </div>
  )
}
