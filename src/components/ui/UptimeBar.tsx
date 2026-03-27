// src/components/ui/UptimeBar.tsx
//
// Functions: UptimeBar

"use client"

import { useMemo, useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"

interface UptimeBucket {
  bucketTs: string
  ok: number
  fail: number
}

interface UptimeBarProps {
  buckets: UptimeBucket[]
  uptimePercent: number | null
  className?: string
}

const BUCKET_MS = 5 * 60 * 1000
const TOTAL_BUCKETS = 288 // 24h / 5min

function bucketColor(ok: number, fail: number): string {
  if (ok === 0 && fail === 0) return CHART_THEME.controlBg
  if (fail === 0) return CHART_THEME.success
  if (ok === 0) return CHART_THEME.danger
  return CHART_THEME.warn
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function UptimeBar({ buckets, uptimePercent, className = "" }: UptimeBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const blocks = useMemo(() => {
    const now = Date.now()
    const startTs = now - 24 * 60 * 60 * 1000
    const startBucket = startTs - (startTs % BUCKET_MS)

    const bucketMap = new Map<number, UptimeBucket>()
    for (const b of buckets) {
      const ts = new Date(b.bucketTs).getTime()
      bucketMap.set(ts, b)
    }

    const result: { ts: number; ok: number; fail: number }[] = []
    for (let i = 0; i < TOTAL_BUCKETS; i++) {
      const ts = startBucket + i * BUCKET_MS
      const found = bucketMap.get(ts)
      result.push({
        ts,
        ok: found?.ok ?? 0,
        fail: found?.fail ?? 0,
      })
    }
    return result
  }, [buckets])

  const percentLabel = uptimePercent != null ? `${uptimePercent}%` : "—"

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-tertiary">Uptime (24h)</span>
        <span
          className={`text-xs font-mono font-semibold ${
            uptimePercent != null && uptimePercent >= 99
              ? "text-success"
              : uptimePercent != null && uptimePercent >= 90
                ? "text-warn"
                : uptimePercent != null
                  ? "text-danger"
                  : "text-tertiary"
          }`}
        >
          {percentLabel}
        </span>
      </div>

      <div className="relative">
        <div className="nm-inset rounded-md p-[2px]">
          <div className="flex gap-[1px] rounded-sm overflow-hidden">
            {blocks.map((block, i) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: decorative hover for chart tooltip
              <div
                key={block.ts}
                className="flex-1 h-3 transition-opacity duration-100 cursor-default relative"
                style={{
                  backgroundColor: bucketColor(block.ok, block.fail),
                  opacity: hoveredIndex != null && hoveredIndex !== i ? 0.5 : 1,
                  minWidth: "1px",
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}
          </div>
        </div>

        {hoveredIndex != null && blocks[hoveredIndex] && (
          <div
            className="absolute z-10 bottom-full mb-2 px-2 py-1 rounded-md text-xs font-mono whitespace-nowrap pointer-events-none"
            style={{
              backgroundColor: CHART_THEME.tooltipBg,
              border: `1px solid ${CHART_THEME.tooltipBorder}`,
              color: CHART_THEME.textPrimary,
              left: `clamp(40px, ${(hoveredIndex / TOTAL_BUCKETS) * 100}%, calc(100% - 40px))`,
              transform: "translateX(-50%)",
            }}
          >
            <div>{formatTime(blocks[hoveredIndex].ts)}</div>
            <div>
              {blocks[hoveredIndex].ok + blocks[hoveredIndex].fail === 0
                ? "No data"
                : `${blocks[hoveredIndex].ok}/${blocks[hoveredIndex].ok + blocks[hoveredIndex].fail} OK`}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-3xs font-mono text-tertiary/60">24h ago</span>
        <span className="text-3xs font-mono text-tertiary/60">now</span>
      </div>
    </div>
  )
}

export { UptimeBar }
