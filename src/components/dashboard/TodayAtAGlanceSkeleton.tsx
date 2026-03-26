// src/components/dashboard/TodayAtAGlanceSkeleton.tsx

"use client"

import { Card } from "@/components/ui/Card"

function Shimmer({ className }: { className?: string }) {
  return <div className={`bg-control-bg rounded-nm-sm animate-pulse ${className ?? ""}`} />
}

const STAT_KEYS = ["upload", "download", "buffer", "ratio", "bonus"] as const
const PANEL_KEYS = ["upload-panel", "download-panel"] as const

export function TodayAtAGlanceSkeleton() {
  return (
    <Card>
      <div className="flex flex-col gap-5">
        {/* Fleet headline — 5 stat card placeholders */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_KEYS.map((key) => (
            <div key={key} className="bg-raised p-5 flex flex-col gap-3 nm-raised-sm rounded-nm-lg">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-20" />
            </div>
          ))}
        </div>

        <div className="border-t border-border" />

        {/* Tracker breakdowns — two panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PANEL_KEYS.map((key) => (
            <div key={key} className="nm-inset-sm rounded-nm-md p-4 flex flex-col gap-3">
              <Shimmer className="h-3 w-32" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
