// src/components/layout/ClientStatusWidget.tsx
"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import clsx from "clsx"
import { useEffect, useMemo } from "react"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { DownloadArrowIcon, UploadArrowIcon } from "@/components/ui/Icons"
import { MarqueeText } from "@/components/ui/MarqueeText"
import { Sparkline } from "@/components/ui/Sparkline"
import { useCarousel } from "@/hooks/useCarousel"
import { useLocalStorage } from "@/hooks/useLocalStorage"
import { formatSpeed, formatTimeAgo } from "@/lib/formatters"
import { STORAGE_KEYS } from "@/lib/storage-keys"

interface ClientInfo {
  id: number
  name: string
  enabled: boolean
  lastError: string | null
  errorSince: string | null
  lastPolledAt: string | null
}

interface SpeedPoint {
  up: number
  down: number
}

interface ClientWithSpeeds {
  client: ClientInfo
  speeds: SpeedPoint[]
}

// ---------------------------------------------------------------------------
//  ClientSlide
// ---------------------------------------------------------------------------

function ClientSlide({
  entry,
  expanded,
  onToggle,
}: {
  entry: ClientWithSpeeds
  expanded: boolean
  onToggle: () => void
}) {
  const { client } = entry
  const hasError = !!client.lastError
  const latestSpeed = entry.speeds.at(-1)

  function renderSubline(): React.ReactNode {
    if (hasError) {
      return (
        <span className="text-danger">
          Down{client.errorSince ? ` ${formatTimeAgo(client.errorSince)}` : ""}
        </span>
      )
    }
    if (!expanded && latestSpeed) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-accent">{formatSpeed(latestSpeed.up)}↑</span>
          <span className="text-warn">{formatSpeed(latestSpeed.down)}↓</span>
        </span>
      )
    }
    return "Connected"
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex items-center gap-2 cursor-pointer w-full text-left"
    >
      <span
        className={clsx("color-dot", hasError ? "bg-danger" : "bg-success")}
        style={hasError ? undefined : { boxShadow: "0 0 6px var(--color-success)" }}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <MarqueeText className="text-xs font-mono text-secondary">{client.name}</MarqueeText>
        <span className="text-3xs font-mono text-tertiary">{renderSubline()}</span>
      </div>
      <ChevronToggle expanded={expanded} variant="flip" />
    </button>
  )
}

// ---------------------------------------------------------------------------
//  ClientStatusWidget
// ---------------------------------------------------------------------------

const selectEnabled = (all: ClientInfo[]) => all.filter((c) => c.enabled)

function ClientStatusWidget() {
  const [expanded, setExpanded] = useLocalStorage(STORAGE_KEYS.CLIENT_WIDGET_EXPANDED, false)

  // Set height-based default on first visit (when no preference is stored)
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLIENT_WIDGET_EXPANDED) === null) {
        setExpanded(window.innerHeight >= 800)
      }
    } catch {}
  }, [setExpanded])

  // Fetch enabled clients
  const { data: enabledClients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/clients", { signal })
      if (!res.ok) return [] as ClientInfo[]
      return res.json() as Promise<ClientInfo[]>
    },
    refetchInterval: 10_000,
    select: selectEnabled,
  })

  // Fetch speeds for each enabled client
  // Cache stores raw API shape so FleetSpeedSparklines (same key) gets correct data
  const speedQueries = useQueries({
    queries: enabledClients.map((client) => ({
      queryKey: ["client-speeds", client.id] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const res = await fetch(`/api/clients/${client.id}/speeds`, { signal })
        if (!res.ok)
          return [] as { timestamp: number; uploadSpeed: number; downloadSpeed: number }[]
        return res.json() as Promise<
          { timestamp: number; uploadSpeed: number; downloadSpeed: number }[]
        >
      },
      select: (
        snaps: { timestamp: number; uploadSpeed: number; downloadSpeed: number }[]
      ): SpeedPoint[] => snaps.map((s) => ({ up: s.uploadSpeed, down: s.downloadSpeed })),
      refetchInterval: 10_000,
    })),
  })

  // Combine clients + speeds into entries
  const entries: ClientWithSpeeds[] = useMemo(
    () =>
      enabledClients.map((client, i) => ({
        client,
        speeds: speedQueries[i]?.data ?? [],
      })),
    [enabledClients, speedQueries]
  )

  const loaded = enabledClients.length > 0

  const { activeIndex, direction, animating, goTo, onPointerDownCapture, onPointerUp } =
    useCarousel({ itemCount: entries.length, autoRotateMs: 8000 })

  if (!loaded || entries.length === 0) return null

  const current = entries[activeIndex]

  return (
    <div className="px-3 py-3 border-t border-border shrink-0">
      <div
        className="nm-inset-sm bg-control-bg px-3 pt-2.5 pb-3.5 flex flex-col gap-2 rounded-nm-md touch-pan-y"
        onPointerDown={onPointerDownCapture}
        onPointerUp={onPointerUp}
      >
        <div
          key={activeIndex}
          className="overflow-hidden"
          style={{
            animation: animating
              ? `slideIn${direction === "left" ? "Left" : "Right"} 300ms ease-out both`
              : undefined,
          }}
        >
          <ClientSlide
            entry={current}
            expanded={expanded}
            onToggle={() => setExpanded((prev) => !prev)}
          />

          {/* Collapsible sparklines */}
          {current.speeds.length >= 2 && (
            <div
              className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
              style={{
                gridTemplateRows: expanded ? "1fr" : "0fr",
                opacity: expanded ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-0.5 pt-1.5">
                  {(
                    [
                      { key: "up", color: "accent", Icon: UploadArrowIcon },
                      { key: "down", color: "warn", Icon: DownloadArrowIcon },
                    ] as const
                  ).map(({ key, color, Icon }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Icon
                        width="10"
                        height="10"
                        stroke={`var(--color-${color})`}
                        strokeWidth={2.5}
                        className="shrink-0"
                      />
                      <Sparkline
                        data={current.speeds.map((s) => s[key])}
                        color={`var(--color-${color})`}
                        width={160}
                        height={16}
                      />
                      <span className={`text-xs font-mono text-${color} tabular-nums shrink-0`}>
                        {formatSpeed(current.speeds.at(-1)?.[key] ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dot indicators for carousel */}
        {entries.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-0.5">
            {entries.map((entry, i) => (
              <button
                key={entry.client.id}
                type="button"
                onClick={() => goTo(i)}
                className={clsx(
                  "w-1.5 h-1.5 rounded-full transition-all duration-200 cursor-pointer",
                  i === activeIndex ? "bg-accent scale-125" : "bg-muted hover:bg-tertiary"
                )}
                aria-label={`Show ${entry.client.name}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { ClientStatusWidget }
