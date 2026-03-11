// src/components/dashboard/PollAllButton.tsx
//
// Functions: PollRing, PollAllButton

"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/Button"

function PollRing({ completed, total }: { completed: number; total: number }) {
  const size = 18
  const stroke = 2.5
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const pct = total > 0 ? completed / total : 0
  const offset = circumference * (1 - pct)

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        opacity={0.2}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--color-accent, #00d4ff)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  )
}

interface NdjsonMessage {
  total?: number
  trackerId?: number
  ok?: boolean
  done?: boolean
  failed?: number
}

interface PollAllButtonProps {
  onPollComplete: () => void | Promise<void>
}

export function PollAllButton({ onPollComplete }: PollAllButtonProps) {
  const [polling, setPolling] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [status, setStatus] = useState<"idle" | "success" | "failed">("idle")

  const handleClick = useCallback(async () => {
    if (polling || status !== "idle") return
    setPolling(true)
    setStatus("idle")
    setProgress({ completed: 0, total: 0 })

    let failCount = 0

    try {
      const res = await fetch("/api/trackers/poll-all", { method: "POST" })
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          let msg: NdjsonMessage
          try {
            msg = JSON.parse(line) as NdjsonMessage
          } catch {
            continue // skip malformed line
          }
          if (msg.total !== undefined) {
            setProgress((p) => ({ ...p, total: msg.total as number }))
          } else if (msg.trackerId !== undefined) {
            if (!msg.ok) failCount++
            setProgress((p) => ({ ...p, completed: p.completed + 1 }))
          } else if (msg.done) {
            failCount = msg.failed ?? failCount
          }
        }
      }

      await onPollComplete()
      setStatus(failCount > 0 ? "failed" : "success")
    } catch {
      setStatus("failed")
    } finally {
      setPolling(false)
      setTimeout(() => setStatus("idle"), 3000)
    }
  }, [polling, status, onPollComplete])

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      className="min-w-[136px]"
    >
      <span className="grid [&>*]:col-start-1 [&>*]:row-start-1 [&>*]:flex [&>*]:items-center [&>*]:justify-center [&>*]:transition-opacity [&>*]:duration-200">
        <span className={polling || status !== "idle" ? "opacity-0" : "opacity-100"}>
          Poll All Now
        </span>
        <span className={polling ? "opacity-100" : "opacity-0 pointer-events-none"}>
          <PollRing completed={progress.completed} total={progress.total} />
          <span className="font-mono text-xs tabular-nums ml-2">
            {progress.total > 0
              ? `${progress.completed}/${progress.total}`
              : "Starting…"}
          </span>
        </span>
        <span className={!polling && status === "success" ? "opacity-100" : "opacity-0 pointer-events-none"}>
          ✓ All Polled
        </span>
        <span className={!polling && status === "failed" ? "opacity-100" : "opacity-0 pointer-events-none"}>
          ✕ Some Failed
        </span>
      </span>
    </Button>
  )
}
