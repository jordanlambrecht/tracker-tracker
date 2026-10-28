// src/components/AddTrackerDialog.tsx
"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import Image from "next/image"
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CredentialFields } from "@/components/CredentialFields"
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
import {
  buildCredentialBlob,
  CREDENTIAL_FORMS,
  type CredentialValues,
  credentialFormFor,
  EMPTY_CREDENTIAL_VALUES,
  validateCredentialValues,
} from "@/lib/credential-forms"
import { localDateStr } from "@/lib/formatters"
import {
  MOUSEHOLE_TOKEN_TIP,
  MOUSEHOLE_URL_PLACEHOLDER,
  MOUSEHOLE_URL_TIP,
} from "@/lib/mousehole"

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
          className="absolute top-full left-0 right-0 mt-1 z-40 bg-overlay nm-float-sm py-1 max-h-60 overflow-y-auto styled-scrollbar rounded-nm-md"
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
  existingSlugs?: string[]
}

function AddTrackerDialog({ open, onClose, onAdded, existingSlugs = [] }: AddTrackerDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState("")
  const [nickname, setNickname] = useState("")
  const [credentials, setCredentials] = useState<CredentialValues>(EMPTY_CREDENTIAL_VALUES)
  const [qbtTag, setQbtTag] = useState("")
  const [mouseholeUrl, setMouseholeUrl] = useState("")
  const [mouseholeToken, setMouseholeToken] = useState("")
  const [color, setColor] = useState<string>(CHART_THEME.accent)
  const [joinedAt, setJoinedAt] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ username: string; group: string | null } | null>(
    null
  )

  const setCredentialField = useCallback((field: keyof CredentialValues, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
  }, [])

  const resetForm = useCallback(() => {
    setSelectedPreset("")
    setNickname("")
    setCredentials(EMPTY_CREDENTIAL_VALUES)
    setQbtTag("")
    setMouseholeUrl("")
    setMouseholeToken("")
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
      setColor(entry.color)
      setErrors({})
      setTestResult(null)
    } else {
      setColor(CHART_THEME.accent)
    }
    // Everything typed belongs to the tracker it was typed for. Keeping a token
    // across a switch would send it to the next tracker's host on submit.
    setCredentials(EMPTY_CREDENTIAL_VALUES)
    setMouseholeUrl("")
    setMouseholeToken("")
  }

  const availablePresets = useMemo(() => {
    const taken = new Set(existingSlugs)
    return TRACKER_REGISTRY.filter((t) => !taken.has(t.slug))
  }, [existingSlugs])

  const selectedEntry = TRACKER_REGISTRY.find((t) => t.slug === selectedPreset)
  const trackerName = nickname.trim() || selectedEntry?.name || ""

  // Before a tracker is picked the dialog still shows a UNIT3D token field.
  const credentialForm = selectedEntry ? credentialFormFor(selectedEntry) : CREDENTIAL_FORMS.unit3d

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}

    if (!selectedPreset) {
      next.preset = "Select a tracker"
    }

    const credentialError = validateCredentialValues(credentialForm, credentials)
    if (credentialError) {
      next.apiToken = credentialError
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

    // navigator is a browser-only global; this component is server-rendered on
    // first load, so it is read in the handler and never during render.
    const effectiveApiToken = buildCredentialBlob(credentialForm, credentials, navigator.userAgent)

    try {
      const testRes = await fetch("/api/trackers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedPreset,
          apiToken: effectiveApiToken,
        }),
      })

      const testData = await testRes.json()

      if (!testRes.ok) {
        setErrors({ apiToken: testData.error ?? "Connection failed" })
        return
      }

      setTestResult({ username: testData.username, group: testData.group })

      const saveRes = await fetch("/api/trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trackerName,
          slug: selectedPreset,
          apiToken: effectiveApiToken,
          color,
          qbtTag: qbtTag.trim() || undefined,
          joinedAt: joinedAt || undefined,
          mouseholeUrl: mouseholeUrl.trim() || undefined,
          mouseholeToken: mouseholeToken.trim() || undefined,
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
      setErrors({ form: "Network error. Please try again" })
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

        <div
          className={clsx(
            "flex flex-col",
            credentialForm.kind === "cookies-username" ||
              credentialForm.kind === "token-username" ||
              credentialForm.kind === "login"
              ? "gap-3"
              : "gap-1"
          )}
        >
          <CredentialFields
            form={credentialForm}
            values={credentials}
            onChange={setCredentialField}
            error={errors.apiToken}
            surface="dialog"
            trackerName={selectedEntry?.name ?? ""}
          />
          {testResult && (
            <Notice variant="success">
              Connected as <span className="font-semibold">{testResult.username}</span>
              {testResult.group ? ` (${testResult.group})` : ""}
            </Notice>
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

        {selectedEntry?.platform === "mam" && (
          <>
            <div className="flex items-center gap-1">
              <Input
                label="Mousehole URL (optional)"
                name="tracker-mousehole-url"
                autoComplete="off"
                data-1p-ignore
                value={mouseholeUrl}
                onChange={(e) => setMouseholeUrl(e.target.value)}
                placeholder={MOUSEHOLE_URL_PLACEHOLDER}
              />
              <InfoTip
                content={MOUSEHOLE_URL_TIP}
                size="sm"
                docs={{
                  href: "https://github.com/t-mart/mousehole",
                  description: "Mousehole on GitHub",
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="password"
                label="Mousehole API token"
                name="tracker-mousehole-token"
                autoComplete="off"
                data-1p-ignore
                value={mouseholeToken}
                onChange={(e) => setMouseholeToken(e.target.value)}
                placeholder="••••••••"
              />
              <InfoTip content={MOUSEHOLE_TOKEN_TIP} size="sm" />
            </div>
          </>
        )}

        <ColorPicker label="Color" value={color} onChange={setColor} />

        {selectedEntry && !credentialForm.hidesJoinDate && (
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
