// src/components/tracker-detail/platform/MamBonusWaste.tsx

import { MAM_BONUS_CAP } from "@/lib/adapters/constants"

export interface MamBonusWasteProps {
  seedbonus: number
  seedingCount: number
}
// Rough average — MAM's actual formula varies by torrent size, seeder count, etc.
const ESTIMATED_POINTS_PER_SEED_PER_HOUR = 0.5

export function MamBonusWaste({ seedbonus, seedingCount }: MamBonusWasteProps) {
  if (seedbonus < MAM_BONUS_CAP) return null

  const wastePerHour = seedingCount * ESTIMATED_POINTS_PER_SEED_PER_HOUR
  const wastePerDay = Math.round(wastePerHour * 24)

  return (
    <div className="flex flex-col gap-1">
      <span className="slot-label text-danger">Bonus Cap Reached</span>
      <span className="text-sm font-mono font-semibold text-primary">
        {seedbonus.toLocaleString()} / {MAM_BONUS_CAP.toLocaleString()}
      </span>
      {wastePerDay > 0 && (
        <p className="text-[10px] font-mono text-warn">
          ~{wastePerDay.toLocaleString()} pts/day wasted
        </p>
      )}
    </div>
  )
}
