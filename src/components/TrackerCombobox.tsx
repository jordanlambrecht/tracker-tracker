// src/components/TrackerCombobox.tsx
"use client"

import clsx from "clsx"
import Image from "next/image"
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { TriangleWarningIcon } from "@/components/ui/Icons"
import { Tooltip } from "@/components/ui/Tooltip"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { useClickOutside } from "@/hooks/useClickOutside"

// A defunct tracker can't be added or linked, so the picker leaves it out entirely.
const ADDABLE_TRACKERS = TRACKER_REGISTRY.filter((t) => !t.defunct)

// ---------------------------------------------------------------------------
// Fuzzy match
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}

// ---------------------------------------------------------------------------
// TrackerCombobox
// ---------------------------------------------------------------------------

interface TrackerComboboxProps {
  presets: TrackerRegistryEntry[]
  /** Slugs already added, listed but not selectable. True when the holder is active. */
  held: ReadonlyMap<string, boolean>
  value: string
  onChange: (slug: string) => void
}

function TrackerCombobox({ presets, held, value, onChange }: TrackerComboboxProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedEntry = presets.find((p) => p.slug === value)
  const filtered = query
    ? presets.filter(
        (p) =>
          fuzzyMatch(query, p.name) ||
          fuzzyMatch(query, p.slug) ||
          (p.abbreviation && fuzzyMatch(query, p.abbreviation))
      )
    : presets

  // A tracker already added is listed but can't be picked, so the highlight
  // steps over it and stays put at either end.
  function isPickable(i: number): boolean {
    const entry = filtered[i]
    return entry !== undefined && !held.has(entry.slug)
  }
  function stepFrom(from: number, step: 1 | -1): number {
    for (let i = from + step; i >= 0 && i < filtered.length; i += step) {
      if (isPickable(i)) return i
    }
    return from
  }
  // Opening and typing start on the first row, which may be held.
  const activeIndex = isPickable(highlightIndex) ? highlightIndex : stepFrom(-1, 1)

  useClickOutside(ref, () => setOpen(false), open)

  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, open])

  function handleSelect(slug: string) {
    if (held.has(slug)) return
    onChange(slug)
    setQuery("")
    setOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!open && e.key === "ArrowDown") {
      setOpen(true)
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex(stepFrom(activeIndex, 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(stepFrom(activeIndex, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filtered[activeIndex]) handleSelect(filtered[activeIndex].slug)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="w-full bg-control-bg text-primary font-mono flex items-center gap-2 nm-inset text-sm px-4 py-3 cursor-text rounded-nm-md border-0"
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setOpen(true)
            inputRef.current?.focus()
          }
        }}
        role="combobox"
        tabIndex={0}
        aria-expanded={open}
      >
        {selectedEntry && !open && !query ? (
          <span className="flex-1 truncate">{selectedEntry.name}</span>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlightIndex(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedEntry ? selectedEntry.name : "Search trackers…"}
            className="flex-1 bg-transparent outline-none text-primary placeholder:text-muted font-mono text-sm min-w-0"
            autoComplete="off"
            data-1p-ignore
          />
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
              setQuery("")
            }}
            className="text-muted hover:text-secondary transition-colors cursor-pointer shrink-0 text-xs"
            aria-label="Clear selection"
          >
            ✕
          </button>
        )}
        <span className="text-tertiary text-3xs shrink-0" aria-hidden="true">
          ▾
        </span>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 z-40 bg-overlay nm-float-sm py-1 max-h-60 overflow-y-auto styled-scrollbar rounded-nm-md"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted font-mono">No matches</div>
          ) : (
            filtered.map((entry, i) => {
              const holderActive = held.get(entry.slug)
              const isHeld = holderActive !== undefined
              return (
                <button
                  key={entry.slug}
                  type="button"
                  role="option"
                  aria-selected={entry.slug === value}
                  aria-disabled={isHeld || undefined}
                  disabled={isHeld}
                  onClick={() => handleSelect(entry.slug)}
                  onMouseEnter={isHeld ? undefined : () => setHighlightIndex(i)}
                  className={clsx(
                    "w-full text-left font-mono text-sm px-4 py-2.5 transition-colors duration-100 flex items-center gap-3",
                    isHeld
                      ? "text-muted cursor-not-allowed opacity-50"
                      : entry.slug === value
                        ? "text-accent bg-accent-dim cursor-pointer"
                        : i === activeIndex
                          ? "text-primary bg-overlay cursor-pointer"
                          : "text-secondary hover:text-primary hover:bg-overlay cursor-pointer"
                  )}
                >
                  {entry.logo && (
                    <Image
                      src={entry.logo}
                      alt=""
                      width={18}
                      height={18}
                      className="shrink-0 rounded-sm"
                    />
                  )}
                  <span className="flex-1 truncate">{entry.name}</span>
                  {isHeld && (
                    <span className="text-xs shrink-0">
                      {holderActive ? "Already added" : "Already added (archived)"}
                    </span>
                  )}
                  {entry.warning && (
                    <Tooltip content={entry.warningNote ?? "Warning"}>
                      <span className="shrink-0">
                        <TriangleWarningIcon width="13" height="13" className="text-warn" />
                      </span>
                    </Tooltip>
                  )}
                  {entry.abbreviation && (
                    <span className="text-xs text-muted shrink-0">{entry.abbreviation}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export { ADDABLE_TRACKERS, TrackerCombobox }
