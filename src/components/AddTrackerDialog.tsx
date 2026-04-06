// src/components/AddTrackerDialog.tsx
"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import Image from "next/image"
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { Button } from "@/components/ui/Button"
import { ColorPicker } from "@/components/ui/ColorPicker"
import { Dialog } from "@/components/ui/Dialog"
import { TriangleWarningIcon } from "@/components/ui/Icons"
import { InfoTip } from "@/components/ui/InfoTip"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { QbtTagWarning } from "@/components/ui/QbtTagWarning"
import { Tooltip } from "@/components/ui/Tooltip"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { useClickOutside } from "@/hooks/useClickOutside"
import { normalizeUrl } from "@/lib/data-transforms"
import { localDateStr } from "@/lib/formatters"

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
    ? presets.filter(
        (p) =>
          fuzzyMatch(query, p.name) ||
          fuzzyMatch(query, p.slug) ||
          (p.abbreviation && fuzzyMatch(query, p.abbreviation))
      )
    : presets

  useClickOutside(ref, () => setOpen(false), open)

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
            placeholder={selectedEntry ? selectedEntry.name : "Search trackers..."}
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
          className="absolute top-full left-0 right-0 mt-1 z-40 bg-elevated nm-raised-sm py-1 max-h-60 overflow-y-auto styled-scrollbar rounded-nm-md"
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

function AddTrackerDialog({
  open,
  onClose,
  onAdded,
  existingBaseUrls = [],
}: AddTrackerDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState("")
  const [nickname, setNickname] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [avistazUsername, setAvistazUsername] = useState("")
  const [avistazCookies, setAvistazCookies] = useState("")
  const [qbtTag, setQbtTag] = useState("")
  const [mouseholeUrl, setMouseholeUrl] = useState("")
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
    setAvistazUsername("")
    setAvistazCookies("")
    setQbtTag("")
    setMouseholeUrl("")
    setColor(CHART_THEME.accent)
    setJoinedAt("")
    setErrors({})
    setLoading(false)
    setTestResult(null)
  }, [])

  const handleDialogClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

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
    setAvistazUsername("")
    setAvistazCookies("")
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

    if (selectedEntry?.platform === "avistaz") {
      if (!avistazUsername.trim()) {
        next.apiToken = "Username is required"
      } else if (!avistazCookies.trim()) {
        next.apiToken = "Browser cookies are required"
      } else if (!avistazCookies.includes("=")) {
        next.apiToken =
          "This doesn't look like a cookie string — it should contain key=value pairs (i.e. cf_clearance=abc123; session=xyz)"
      } else if (
        /^(cf_clearance|[a-z]+x_session|remember_web_\w+|XSRF-TOKEN|love)$/i.test(
          avistazCookies.trim()
        )
      ) {
        next.apiToken =
          'You pasted a cookie name, not the value. Copy the entire string after "Cookie:" in the request headers.'
      }
    } else if (!apiToken.trim()) {
      next.apiToken = "API token is required"
    }

    return next
  }

  async function handleSubmit() {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setLoading(true)
    setTestResult(null)

    const isAvistaz = selectedEntry?.platform === "avistaz"
    let effectiveApiToken = apiToken

    if (isAvistaz) {
      effectiveApiToken = JSON.stringify({
        cookies: avistazCookies.trim(),
        userAgent: navigator.userAgent,
        username: avistazUsername.trim(),
      })
    }

    try {
      const testRes = await fetch("/api/trackers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiToken: effectiveApiToken,
          platformType: selectedEntry?.platform ?? "unit3d",
          apiPath: selectedEntry?.apiPath,
        }),
      })

      const testData = await testRes.json()

      if (!testRes.ok) {
        setErrors({ apiToken: testData.error ?? "Connection failed" })
        return
      }

      setTestResult({ username: testData.username, group: testData.group })

      if (isAvistaz && testData.capturedUserAgent) {
        effectiveApiToken = JSON.stringify({
          cookies: avistazCookies.trim(),
          userAgent: testData.capturedUserAgent,
          username: avistazUsername.trim(),
        })
      }

      const saveRes = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trackerName,
          baseUrl,
          apiToken: effectiveApiToken,
          platformType: selectedEntry?.platform ?? "unit3d",
          color,
          qbtTag: qbtTag.trim() || undefined,
          joinedAt: joinedAt || undefined,
          mouseholeUrl: mouseholeUrl.trim() || undefined,
        }),
      })

      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        setErrors({ form: saveData.error ?? "Failed to add tracker" })
        return
      }

      // Fire-and-forget initial poll so the tracker has data immediately
      fetch(`/api/trackers/${saveData.id}/poll`, { method: "POST" }).catch(() => {})

      resetForm()
      onAdded(saveData.id)
    } catch {
      setErrors({ form: "Network error — please try again" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      onSubmit={handleSubmit}
      formProps={
        { autoComplete: "off", "data-1p-ignore": true } as React.HTMLAttributes<HTMLFormElement>
      }
      title="Add Tracker"
      maxWidth="max-w-lg"
      busy={loading}
      footer={
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={loading}
            text={loading ? "Connecting..." : "Add Tracker"}
          />
          <Button variant="ghost" onClick={handleDialogClose} text="Cancel" />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <H2 className="uppercase tracking-wider">Tracker</H2>
          <TrackerCombobox
            presets={availablePresets}
            value={selectedPreset}
            onChange={handlePresetChange}
          />
          <Notice message={errors.preset} />
        </div>

        {selectedEntry?.warning && selectedEntry.warningNote && (
          <Notice variant="warn" box message={selectedEntry.warningNote} />
        )}

        {selectedEntry?.platform === "avistaz" && (
          <Notice
            variant="warn"
            box
            message="AvistaZ network trackers require Member class or above. New accounts start as Validating and cannot access the profile page needed for stat tracking. This tracker won't work until your account is promoted."
          />
        )}

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

        {selectedEntry?.platform === "avistaz" ? (
          <div className="flex flex-col gap-3">
            <Input
              label={`${selectedEntry?.name ?? "AvistaZ"} Username`}
              name="tracker-avistaz-username"
              autoComplete="off"
              data-1p-ignore
              value={avistazUsername}
              onChange={(e) => setAvistazUsername(e.target.value)}
              placeholder="Your username on this tracker"
            />
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tracker-avistaz-cookies"
                className="text-xs uppercase tracking-wider text-secondary font-mono"
              >
                Browser Cookies
              </label>
              <textarea
                id="tracker-avistaz-cookies"
                name="tracker-avistaz-cookies"
                autoComplete="off"
                data-1p-ignore
                value={avistazCookies}
                onChange={(e) => setAvistazCookies(e.target.value)}
                placeholder="Paste Cookie header from browser DevTools (F12 → Network → any request → Cookie)"
                rows={3}
                className="w-full rounded-nm-sm bg-control-bg px-3 py-2 text-sm text-primary border border-transparent focus:border-accent focus:outline-none font-mono resize-y"
              />
              <Notice message={errors.apiToken} />
            </div>
            {testResult && (
              <Notice variant="success">
                Connected as <span className="font-semibold">{testResult.username}</span>
                {testResult.group ? ` (${testResult.group})` : ""}
              </Notice>
            )}
          </div>
        ) : (
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
                selectedEntry?.platform === "mam"
                  ? "Your mam_id session cookie"
                  : selectedEntry?.platform === "ggn"
                    ? "Your GGn API key"
                    : selectedEntry?.platform === "gazelle"
                      ? "Your Gazelle API key"
                      : "Your UNIT3D API token"
              }
              error={errors.apiToken}
            />
            {testResult && (
              <Notice variant="success">
                Connected as <span className="font-semibold">{testResult.username}</span>
                {testResult.group ? ` (${testResult.group})` : ""}
              </Notice>
            )}
          </div>
        )}

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

        {selectedEntry?.platform === "mam" && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <Input
                label="Mousehole URL (optional)"
                name="tracker-mousehole-url"
                autoComplete="off"
                data-1p-ignore
                value={mouseholeUrl}
                onChange={(e) => setMouseholeUrl(e.target.value)}
                placeholder="http://localhost:7001"
              />
              <InfoTip
                content="If you run Mousehole to manage your MAM seedbox IP, enter its URL here to see status and trigger updates from Tracker Tracker."
                size="sm"
                docs={{
                  href: "https://github.com/t-mart/mousehole",
                  description: "Mousehole on GitHub",
                }}
              />
            </div>
          </div>
        )}

        <ColorPicker label="Color" value={color} onChange={setColor} />

        {!(
          selectedEntry?.gazelleEnrich ||
          selectedEntry?.platform === "ggn" ||
          selectedEntry?.platform === "avistaz"
        ) && (
          <Input
            label="Join Date (optional)"
            type="date"
            value={joinedAt}
            max={localDateStr()}
            onChange={(e) => setJoinedAt(e.target.value)}
            placeholder="YYYY-MM-DD"
          />
        )}

        <Notice message={errors.form} />
      </div>
    </Dialog>
  )
}

export { AddTrackerDialog }
