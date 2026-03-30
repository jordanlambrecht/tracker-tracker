// src/components/tracker-detail/platform/MamMouseholeCard.tsx
"use client"

import clsx from "clsx"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/Button"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { Notice } from "@/components/ui/Notice"
import { Tooltip } from "@/components/ui/Tooltip"
import { useLocalStorage } from "@/hooks/useLocalStorage"

interface MouseholeResponse {
  ok: boolean
  reason: string
  ip: string | null
  asn: number | null
  asOrg: string | null
  nextUpdateAt: string | null
  lastUpdateAt: string | null
  lastUpdateResult: string | null
  mamUpdated: boolean | null
}

export interface MamMouseholeCardProps {
  trackerId: number
  mouseholeUrl: string
}

function parseRfc9557(dateStr: string): Date {
  return new Date(dateStr.replace(/\[.*\]$/, ""))
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00"
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, "0")).join(":")
}

function formatResult(msg: string): string {
  switch (msg) {
    case "Completed":
      return "IP updated"
    case "No change":
    case "No Change":
      return "No change needed"
    default:
      return msg
  }
}

export function MamMouseholeCard({ trackerId, mouseholeUrl }: MamMouseholeCardProps) {
  const [data, setData] = useState<MouseholeResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [countdown, setCountdown] = useState<string>("--:--:--")
  const [expanded, setExpanded] = useLocalStorage("tracker-tracker:mousehole-expanded", true)

  const nextUpdateAtRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const fetchStateRef = useRef<() => void>(() => {})

  const fetchState = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/trackers/${trackerId}/mousehole`, { signal })
        if (!mountedRef.current) return
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setFetchError(body?.error ?? `HTTP ${res.status}`)
          return
        }
        const json: MouseholeResponse = await res.json()
        setData(json)
        setFetchError(null)
        nextUpdateAtRef.current = json.nextUpdateAt
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        if (!mountedRef.current) return
        setFetchError(err instanceof Error ? err.message : "Failed to reach Mousehole")
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [trackerId]
  )

  // Keep ref in sync so the countdown effect can call it without a dep change
  fetchStateRef.current = () => {
    fetchState()
  }

  // Polling
  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    fetchState(controller.signal)
    const id = setInterval(() => fetchState(controller.signal), 60_000)
    return () => {
      mountedRef.current = false
      controller.abort()
      clearInterval(id)
    }
  }, [fetchState])

  // Countdown
  useEffect(() => {
    let prev = ""
    let refetched = false
    function tick() {
      const raw = nextUpdateAtRef.current
      if (!raw) {
        if (prev !== "--:--:--") {
          setCountdown("--:--:--")
          prev = "--:--:--"
        }
        return
      }
      const ms = parseRfc9557(raw).getTime() - Date.now()
      const next = formatCountdown(ms)
      if (next !== prev) {
        setCountdown(next)
        prev = next
      }
      if (ms <= 0 && !refetched) {
        refetched = true
        fetchStateRef.current()
      }
      if (ms > 0) {
        refetched = false
      }
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [])

  const handleCheckNow = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch(`/api/trackers/${trackerId}/mousehole`, { method: "POST" })
      if (!mountedRef.current) return
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(body?.error ?? `HTTP ${res.status}`)
        return
      }
      await fetchState()
    } catch (err) {
      if (!mountedRef.current) return
      setFetchError(err instanceof Error ? err.message : "Check failed")
    } finally {
      if (mountedRef.current) setChecking(false)
    }
  }, [trackerId, fetchState])

  if (loading) {
    return (
      <div className="nm-inset-sm bg-control-bg p-4 max-w-xl rounded-nm-md">
        <div className="flex items-center gap-2">
          <Image
            src="/tracker-logos/mousehole_logo.svg"
            alt=""
            width={18}
            height={18}
            className="invert opacity-40"
            aria-hidden="true"
          />
          <span className="text-xs font-mono text-muted animate-pulse">
            Connecting to Mousehole...
          </span>
        </div>
      </div>
    )
  }

  if (fetchError && !data) {
    return (
      <div className="nm-inset-sm bg-control-bg p-4 max-w-xl rounded-nm-md flex items-center gap-3">
        <Image
          src="/tracker-logos/mousehole_logo.svg"
          alt=""
          width={24}
          height={24}
          className="invert opacity-30"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-sans font-medium text-secondary">Mousehole</span>
          <Notice message={fetchError} />
        </div>
      </div>
    )
  }

  if (!data) return null

  const isOk = data.ok
  const isStale = !data.ok && data.reason === "needs_update"
  const countdownExpired = countdown === "00:00:00"

  return (
    <div className="nm-inset-sm bg-control-bg max-w-xl rounded-nm-md flex overflow-hidden">
      {/* Left: Logo — clickable, links to user's Mousehole instance */}
      <a
        href={mouseholeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center px-4 shrink-0 rounded-l-nm-md hover:bg-overlay/20 transition-colors"
        title="Open Mousehole"
      >
        <Image
          src="/tracker-logos/mousehole_logo.svg"
          alt="Mousehole"
          width={32}
          height={32}
          className="invert opacity-70"
          aria-hidden="true"
        />
      </a>

      {/* Right: Content — separated from logo by gap, not border */}
      <div className="flex flex-col flex-1 min-w-0 py-3 pr-4 pl-1">
        {/* Header — always visible */}
        <div className="flex items-center justify-between gap-4 w-full">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 cursor-pointer min-w-0"
          >
            <ChevronToggle expanded={expanded} className="text-muted" />
            <span
              className={clsx(
                "inline-block w-2 h-2 rounded-full shrink-0",
                isOk ? "bg-success animate-pulse-glow" : isStale ? "bg-warn" : "bg-danger"
              )}
            />
            <span
              className={clsx(
                "text-sm font-mono font-semibold tracking-wider uppercase",
                isOk ? "text-success" : isStale ? "text-warn" : "text-danger"
              )}
            >
              {isOk ? "OK" : isStale ? "Stale" : "Down"}
            </span>
            <span className="text-xs font-sans text-muted">Mousehole</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            {/* Countdown */}
            <span
              className={clsx(
                "text-xs font-mono transition-opacity duration-300",
                expanded ? "opacity-0" : "opacity-100"
              )}
            >
              <span
                className={clsx(
                  "font-semibold tabular-nums",
                  countdownExpired ? "text-muted" : "text-secondary"
                )}
              >
                {countdown}
              </span>
            </span>
            <Tooltip
              content="Mousehole keeps your MAM seedbox IP updated automatically."
              docs={{ href: "https://github.com/t-mart/mousehole", description: "Mousehole docs" }}
            >
              <span className="text-muted hover:text-secondary cursor-help text-xs ml-1">
                &#9432;
              </span>
            </Tooltip>
          </div>
        </div>

        {/* Expandable details */}
        <div
          className={clsx(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            expanded ? "max-h-75 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="flex flex-col gap-2 mt-2.5">
            {/* IP + ASN */}
            <div className="flex items-baseline gap-2 text-xs font-mono">
              <span className="text-secondary">{data.ip ?? "No IP"}</span>
              {data.asn != null && (
                <span className="text-muted">
                  AS{data.asn}
                  {data.asOrg ? `, ${data.asOrg}` : ""}
                </span>
              )}
            </div>

            {/* Last result */}
            {data.lastUpdateResult && (
              <div className="text-xs font-mono text-muted">
                Last check: {formatResult(data.lastUpdateResult)}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center justify-between gap-4 mt-1">
              <span className="text-xs font-mono text-tertiary">
                Next check{" "}
                <span
                  className={clsx(
                    "font-semibold tabular-nums",
                    countdownExpired ? "text-muted" : "text-secondary"
                  )}
                >
                  {countdown}
                </span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={checking}
                onClick={handleCheckNow}
                text={checking ? "Checking..." : "Check Now"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
