// src/components/layout/WhatsNew.tsx

"use client"

import { H3, Paragraph, Subheader } from "@typography"
import { useEffect, useState } from "react"
import { Button, Dialog, Shimmer } from "@/components/ui"

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"
const STORAGE_KEY = "lastSeenVersion"

export function WhatsNew() {
  const [open, setOpen] = useState(false)
  const [changes, setChanges] = useState<string[] | null>(null)
  const [lastSeen, setLastSeen] = useState<string | null>(null)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen === APP_VERSION) return
    setLastSeen(seen)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return

    fetch("/api/changelog")
      .then((r) => r.json())
      .then((data: { content: string }) => {
        setChanges(parseMissedReleases(data.content, lastSeen))
      })
      .catch(() => setChanges([]))
  }, [open])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, APP_VERSION)
    setOpen(false)
  }

  return (
    <Dialog open={open} onClose={dismiss} title="What's New" size="sm" maxWidth="max-w-sm" maxHeight="70vh">
      <div className="text-center mb-3">
        <div className="text-2xl mb-2" aria-hidden="true">
          &#127881;
        </div>
        <H3>New Version</H3>
        <Subheader className="font-mono text-accent mt-0.5">v{APP_VERSION}</Subheader>
      </div>

      <div className="max-h-48 overflow-y-auto styled-scrollbar">
        {changes === null ? (
          <div className="flex flex-col gap-1.5 py-1">
            <Shimmer size="bar" className="w-full" />
            <Shimmer size="bar" className="w-4/5" />
            <Shimmer size="bar" className="w-full" />
          </div>
        ) : changes.length > 0 ? (
          <ul className="space-y-1.5">
            {changes.map((line) => (
              <li key={line} className="text-xs text-secondary leading-relaxed flex gap-2">
                <span className="text-accent mt-px shrink-0">&bull;</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Paragraph className="text-center">Bug fixes and improvements.</Paragraph>
        )}
      </div>

      <div className="pt-4">
        <Button variant="primary" size="md" className="w-full" onClick={dismiss} text="Neat" />
      </div>
    </Dialog>
  )
}

/**
 * Extract bullet items from all changelog sections between the current
 * version and the last version the user saw. If lastSeen is null (i.e.
 * localStorage was cleared or first install), only show the latest release
 * to avoid dumping the entire history.
 */
function parseMissedReleases(content: string, lastSeen: string | null): string[] {
  const lines = content.split("\n")
  const items: string[] = []
  let collecting = false
  let releasesCollected = 0
  const maxReleases = lastSeen === null ? 1 : 10

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const version = line.match(/## (\d+\.\d+\.\d+)/)?.[1]
      if (version === lastSeen) break
      collecting = true
      releasesCollected++
      if (releasesCollected > maxReleases) break
      continue
    }
    if (!collecting) continue

    const match = line.match(/^\*\s+(?:\*\*[^*]+\*\*\s*)?(.+)/)
    if (match) {
      items.push(match[1].replace(/\*\*/g, "").replace(/`/g, "").trim())
    }
  }

  return items
}
