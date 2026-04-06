// src/app/(auth)/trackers/[id]/loading.tsx

import { Card, Shimmer } from "@/components/ui"

export default function TrackerDetailLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-12">
      {/* Header: name + stats */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Shimmer rounded="full" className="h-10 w-10" />
          <Shimmer size="value" className="w-56" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`stat-${i}`}
              className="bg-raised p-4 flex flex-col gap-2 nm-raised-sm rounded-nm-lg"
            >
              <Shimmer size="label" className="w-20" />
              <Shimmer size="heading" className="w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar placeholder */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Shimmer key={`tab-${i}`} className="h-9 w-24" rounded="md" />
        ))}
      </div>

      {/* Chart placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={`chart-${i}`}>
            <div className="flex flex-col gap-4">
              <Shimmer size="heading" className="w-40" />
              <Shimmer className="h-48 w-full" rounded="md" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
