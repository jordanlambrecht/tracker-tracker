// src/components/tracker-detail/platform/MamVipCountdown.tsx

import { ProgressBar } from "@/components/ui/ProgressBar"

export interface MamVipCountdownProps {
  vipUntil: string
  accentColor: string
}

export function MamVipCountdown({ vipUntil, accentColor }: MamVipCountdownProps) {
  const expiry = new Date(vipUntil)
  if (Number.isNaN(expiry.getTime())) return null

  const msRemaining = expiry.getTime() - Date.now()
  if (msRemaining <= 0) return null

  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))
  // VIP duration varies by donation tier. 90 days is a reasonable default for the progress bar
  const totalDays = 90
  const pct = (daysRemaining / totalDays) * 100

  let urgencyColor = accentColor
  if (daysRemaining <= 3) urgencyColor = "var(--color-danger)"
  else if (daysRemaining <= 7) urgencyColor = "var(--color-warn)"

  const dateStr = expiry.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="slot-label">VIP Expires</span>
        <span className="text-secondary font-semibold">{daysRemaining}d remaining</span>
      </div>
      <ProgressBar percent={pct} color={urgencyColor} size="sm" />
      <p className="text-[10px] font-mono text-muted text-right">{dateStr}</p>
    </div>
  )
}
