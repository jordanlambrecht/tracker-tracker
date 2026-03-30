// src/app/(auth)/DashboardSkeleton.tsx

import { Card } from "@/components/ui/Card"
import { Shimmer } from "@/components/ui/Shimmer"

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto pb-12">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Shimmer size="value" className="w-48" />
        <div className="flex items-center gap-2">
          <Shimmer className="h-9 w-24" rounded="md" />
          <Shimmer className="h-9 w-9" rounded="md" />
        </div>
      </div>

      {/* Today At A Glance */}
      <div className="flex flex-col gap-4">
        <Shimmer size="heading" className="w-44" />
        <Card>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="bg-raised p-5 flex flex-col gap-3 nm-raised-sm rounded-nm-lg">
                  <Shimmer size="text" className="w-24" />
                  <Shimmer size="value" className="w-20" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Tracker Overview */}
      <div className="flex flex-col gap-4">
        <Shimmer size="heading" className="w-28" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <div className="flex flex-col gap-3 p-1">
                <div className="flex items-center gap-3">
                  <Shimmer rounded="full" className="h-8 w-8" />
                  <Shimmer size="heading" className="w-32" />
                </div>
                <div className="flex gap-4">
                  <Shimmer size="bar" className="w-20" />
                  <Shimmer size="bar" className="w-20" />
                  <Shimmer size="bar" className="w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export { DashboardSkeleton }
