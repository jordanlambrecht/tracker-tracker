// src/components/AddTrackerDialog.tsx
"use client"
//
// Functions: AddTrackerDialog

import clsx from "clsx"
import Image from "next/image"
import { type FormEvent, type KeyboardEvent, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CHART_THEME } from "@/components/charts/theme"
import { Button } from "@/components/ui/Button"
import { ColorPicker } from "@/components/ui/ColorPicker"
import { TriangleWarningIcon } from "@/components/ui/Icons"
import { Input } from "@/components/ui/Input"
import { QbtTagWarning } from "@/components/ui/QbtTagWarning"
import { H2 } from "@/components/ui/Typography"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { useClickOutside } from "@/hooks/useClickOutside"
import { normalizeUrl } from "@/lib/url"

// ---------------------------------------------------------------------------
// Fuzzy match — matches if all query chars appear in order in the target
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
// TrackerCombobox — searchable dropdown for tracker selection
// ---------------------------------------------------------------------------

interface TrackerComboboxProps {
  presets: TrackerRegistryEntry[]
  value: string
  onChange: (slug: string) => void
}

function TrackerCombobox({ presets, value, onChange }: TrackerComboboxProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedEntry = presets.find((p) => p.slug === value)
  const filtered = query
    ? presets.filter((p) => fuzzyMatch(query, p.name) || fuzzyMatch(query, p.slug) || (p.abbreviation && fuzzyMatch(query, p.abbreviation)))
    : presets

  // Close on outside click
  useClickOutside(ref, () => setOpen(false), open)

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightIndex, open])

  function handleSelect(slug: string) {
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
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex].slug)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="w-full bg-control-bg text-primary font-mono flex items-center gap-2 nm-inset text-sm px-4 py-3 cursor-text rounded-nm-md border-0"
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setOpen(true); inputRef.current?.focus() } }}
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
            onChange={(e) => { setQuery(e.target.value); setHighlightIndex(0); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedEntry ? selectedEntry.name : "Search trackers..."}
            className="flex-1 bg-transparent outline-none text-primary placeholder:text-muted font-mono text-sm min-w-0"
            autoComplete="off"
            data-1p-ignore
          />
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setQuery("") }}
            className="text-muted hover:text-secondary transition-colors cursor-pointer shrink-0 text-xs"
            aria-label="Clear selection"
          >
            ✕
          </button>
        )}
        <span className="text-tertiary text-[10px] shrink-0" aria-hidden="true">▾</span>
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-elevated nm-raised-sm py-1 max-h-60 overflow-y-auto styled-scrollbar rounded-nm-md"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted font-mono">No matches</div>
          ) : (
            filtered.map((entry, i) => (
              <button
                key={entry.slug}
                type="button"
                role="option"
                aria-selected={entry.slug === value}
                onClick={() => handleSelect(entry.slug)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={clsx(
                  "w-full text-left font-mono text-sm px-4 py-2.5 transition-colors duration-100 flex items-center gap-3",
                  entry.slug === value
                    ? "text-accent bg-accent-dim cursor-pointer"
                    : i === highlightIndex
                      ? "text-primary bg-overlay cursor-pointer"
                      : "text-secondary hover:text-primary hover:bg-overlay cursor-pointer",
                )}
              >
                {entry.logo && (
                  <Image src={entry.logo} alt="" width={18} height={18} className="shrink-0 rounded-sm" />
                )}
                <span className="flex-1 truncate">{entry.name}</span>
                {entry.warning && (
                  <span className="flex items-center gap-1 shrink-0" title={entry.warningNote}>
                    <TriangleWarningIcon width="13" height="13" className="text-warn" />
                    {entry.warningNote && (
                      <span className="text-[10px] text-warn">{entry.warningNote}</span>
                    )}
                  </span>
                )}
                {entry.abbreviation && (
                  <span className="text-xs text-muted shrink-0">{entry.abbreviation}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddTrackerDialog
// ---------------------------------------------------------------------------

interface AddTrackerDialogProps {
  open: boolean
  onClose: () => void
  onAdded: (trackerId: number) => void
  existingBaseUrls?: string[]
}

function AddTrackerDialog({ open, onClose, onAdded, existingBaseUrls = [] }: AddTrackerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [selectedPreset, setSelectedPreset] = useState("")
  const [nickname, setNickname] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [qbtTag, setQbtTag] = useState("")
  const [color, setColor] = useState<string>(CHART_THEME.accent)
  const [joinedAt, setJoinedAt] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ username: string; group: string } | null>(null)

  const resetForm = useCallback(() => {
    setSelectedPreset("")
    setNickname("")
    setBaseUrl("")
    setApiToken("")
    setQbtTag("")
    setColor(CHART_THEME.accent)
    setJoinedAt("")
    setErrors({})
    setLoading(false)
    setTestResult(null)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleNativeClose() {
      resetForm()
      onClose()
    }

    dialog.addEventListener("close", handleNativeClose)
    return () => {
      dialog.removeEventListener("close", handleNativeClose)
    }
  }, [onClose, resetForm])

  function handleBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  function handleDialogKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === "Escape") {
      dialogRef.current?.close()
    }
  }

  function handlePresetChange(slug: string) {
    setSelectedPreset(slug)
    const entry = TRACKER_REGISTRY.find((t) => t.slug === slug)
    if (entry) {
      setBaseUrl(entry.url)
      setColor(entry.color)
      setErrors({})
      setTestResult(null)
    } else {
      setBaseUrl("")
      setColor(CHART_THEME.accent)
    }
  }

  const availablePresets = useMemo(() => {
    const urls = new Set(existingBaseUrls.map(normalizeUrl))
    return TRACKER_REGISTRY.filter((t) => !urls.has(normalizeUrl(t.url)))
  }, [existingBaseUrls])

  const selectedEntry = TRACKER_REGISTRY.find((t) => t.slug === selectedPreset)
  const trackerName = nickname.trim() || selectedEntry?.name || ""

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}

    if (!selectedPreset && !baseUrl.trim()) {
      next.preset = "Select a tracker or enter a Base URL"
    }
    if (!baseUrl.trim()) {
      next.baseUrl = "Base URL is required"
    } else {
      try {
        new URL(baseUrl)
      } catch {
        next.baseUrl = "Invalid URL format"
      }
    }
    if (!apiToken.trim()) {
      next.apiToken = "API token is required"
    }

    return next
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setLoading(true)
    setTestResult(null)

    try {
      const testRes = await fetch("/api/trackers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiToken,
          platformType: selectedEntry?.platform ?? "unit3d",
          apiPath: selectedEntry?.apiPath,
        }),
      })

      const testData = await testRes.json()

      if (!testRes.ok) {
        setErrors({ apiToken: testData.error ?? "Connection failed" })
        setLoading(false)
        return
      }

      setTestResult({ username: testData.username, group: testData.group })

      const saveRes = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trackerName,
          baseUrl,
          apiToken,
          platformType: selectedEntry?.platform ?? "unit3d",
          color,
          qbtTag: qbtTag.trim() || undefined,
          joinedAt: joinedAt || undefined,
        }),
      })

      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        setErrors({ form: saveData.error ?? "Failed to add tracker" })
        setLoading(false)
        return
      }

      // Fire-and-forget initial poll so the tracker has data immediately
      fetch(`/api/trackers/${saveData.id}/poll`, { method: "POST" }).catch(() => {})

      resetForm()
      onAdded(saveData.id)
    } catch {
      setErrors({ form: "Network error — please try again" })
      setLoading(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onKeyDown={handleDialogKeyDown}
      className="fixed inset-0 m-auto w-full max-w-lg bg-elevated p-0 overflow-visible backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex open:flex-col nm-raised-lg rounded-nm-xl border-0"
    >
      <div className="flex flex-col w-full p-6 gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <H2 className="text-base font-semibold text-primary">Add Tracker</H2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-tertiary hover:text-primary transition-colors cursor-pointer p-1 -m-1 rounded-nm-sm"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" autoComplete="off" data-1p-ignore>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-sans font-medium text-secondary uppercase tracking-wider">
              Tracker
            </span>
            <TrackerCombobox
              presets={availablePresets}
              value={selectedPreset}
              onChange={handlePresetChange}
            />
            {errors.preset && (
              <p className="text-xs font-sans text-danger" role="alert">
                {errors.preset}
              </p>
            )}
          </div>

          <Input
            label="Nickname (optional)"
            name="tracker-nickname"
            autoComplete="off"
            data-1p-ignore
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={selectedEntry?.name ?? "Custom name for this tracker"}
          />

          <Input
            label="Base URL"
            name="tracker-url"
            autoComplete="off"
            data-1p-ignore
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://aither.cc"
            error={errors.baseUrl}
          />

          <div className="flex flex-col gap-1">
            <Input
              label="API Token"
              name="tracker-api-token"
              type="password"
              autoComplete="off"
              data-1p-ignore
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={
                selectedEntry?.platform === "ggn"
                  ? "Your GGn API key"
                  : selectedEntry?.platform === "gazelle"
                    ? "Your Gazelle API key"
                    : "Your UNIT3D API token"
              }
              error={errors.apiToken}
            />
            {testResult && (
              <p className="text-xs font-sans text-success">
                Connected as <span className="font-semibold">{testResult.username}</span>
                {testResult.group ? ` (${testResult.group})` : ""}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="qBittorrent Tag"
              name="tracker-qbt-tag"
              autoComplete="off"
              data-1p-ignore
              value={qbtTag}
              onChange={(e) => setQbtTag(e.target.value)}
              placeholder={selectedEntry ? `i.e, ${selectedEntry.slug}` : "i.e, tracker-name"}
            />
            <QbtTagWarning tag={qbtTag} />
          </div>

          <ColorPicker label="Color" value={color} onChange={setColor} />

          <Input
            label="Join Date (optional)"
            type="date"
            value={joinedAt}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setJoinedAt(e.target.value)}
            placeholder="YYYY-MM-DD"
          />

          {errors.form && (
            <p className="text-xs font-sans text-danger" role="alert">
              {errors.form}
            </p>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading}>
              {loading ? "Connecting..." : "Add Tracker"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

export { AddTrackerDialog }
