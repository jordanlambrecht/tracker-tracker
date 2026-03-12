// src/components/dashboard/torrents/CategoryCard.tsx

"use client"

import { useState } from "react"
import { TorrentCategoryDonut } from "@/components/charts/TorrentCategoryDonut"
import { TorrentCategoryRadar } from "@/components/charts/TorrentCategoryRadar"
import { Card } from "@/components/ui/Card"
import { TabBar } from "@/components/ui/TabBar"
import { H2 } from "@/components/ui/Typography"
import type { CategoryStats } from "@/lib/torrent-utils"

type CategoryView = "radar" | "donut"

interface CategoryCardProps {
  categories: CategoryStats[]
  accentColor: string
}

export function CategoryCard({
  categories,
  accentColor,
}: CategoryCardProps) {
  const [view, setView] = useState<CategoryView>("donut")

  return (
    <Card trackerColor={accentColor} className="flex flex-col gap-4">
      <H2 className="text-sm font-sans font-semibold text-primary uppercase tracking-wider">
        Categories
      </H2>
      <TabBar
        tabs={[
          { key: "donut" as CategoryView, label: "Distribution" },
          { key: "radar" as CategoryView, label: "Profile" },
        ]}
        activeTab={view}
        onChange={setView}
      />
      {view === "donut" ? (
        <TorrentCategoryDonut categories={categories} accentColor={accentColor} />
      ) : (
        <TorrentCategoryRadar categories={categories} accentColor={accentColor} />
      )}
    </Card>
  )
}
