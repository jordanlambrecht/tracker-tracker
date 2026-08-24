// src/components/TrackerSettingsSheet.tsx
"use client"

import { useQueryClient } from "@tanstack/react-query"
import { H2 } from "@typography"
import clsx from "clsx"
import { useRouter } from "next/navigation"
import { type SyntheticEvent, useCallback, useEffect, useState } from "react"
import {
  Button,
  ConfirmRemove,
  InfoTip,
  Input,
  MaskedSecret,
  Notice,
  QbtTagWarning,
  Sheet,
  Toggle,
} from "@/components/ui"
import { ColorPicker } from "@/components/ui/ColorPicker"

import { findRegistryEntry } from "@/data/tracker-registry"
import { DOCS } from "@/lib/constants"
import { localDateStr } from "@/lib/formatters"
import { trackerQueryOptions } from "@/lib/query-options"
import type { TrackerSummary } from "@/types/api"

interface TrackerSettingsSheetProps {
  open: boolean
  tracker: TrackerSummary
  onClose: () => void
  /**
   * Receives the tracker exactly as the PATCH response returned it. The sheet
   * already holds the post-write row. Consumers must not re-GET it. That extra
   * round trip adds latency to save/archive.
   */
  onUpdated: (updated: TrackerSummary) => void
}

interface FormState {
  name: string
  color: string
  qbtTag: string
  joinedAt: string
  lastAccessAt: string
  baseUrl: string
  useProxy: boolean
  countCrossSeedUnsatisfied: boolean
  hideUnreadBadges: boolean
  mouseholeUrl: string
}

function formStateFromTracker(t: TrackerSummary): FormState {
  return {
    name: t.name,
    color: t.color,
    qbtTag: t.qbtTag ?? "",
    joinedAt: t.joinedAt ?? "",
    lastAccessAt: t.lastAccessAt ?? "",
    baseUrl: t.baseUrl,
    useProxy: t.useProxy ?? false,
    countCrossSeedUnsatisfied: t.countCrossSeedUnsatisfied ?? false,
    hideUnreadBadges: t.hideUnreadBadges ?? false,
    mouseholeUrl: t.mouseholeUrl ?? "",
  }
}

function TrackerSettingsSheet({ open, tracker, onClose, onUpdated }: TrackerSettingsSheetProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Every write mutates a row in the shared ["trackers"] cache, which
  // useTrackerList and useDashboardData render from. That cache is NOT
  // remounted by `router.push("/")`. The sidebar sits in the persistent auth
  // layout. Its only automatic repair is `refetchInterval`, derived from
  // trackerPollIntervalMinutes (15 min floor, 60 min default). Without explicit
  // write-through + invalidate, an archived tracker renders as active and the
  // "Show Archived (N)" counter under-reports for up to an hour. This mirrors
  // toggleFavorite and handleDragEnd in useTrackerList.
  const syncTrackerCache = useCallback(
    (next: TrackerSummary | null) => {
      queryClient.setQueryData<TrackerSummary[]>(trackerQueryOptions.queryKey, (prev) => {
        if (!prev) return prev
        if (!next) return prev.filter((t) => t.id !== tracker.id)
        return prev.map((t) => (t.id === next.id ? next : t))
      })
      // Not awaited: the refetch is a background confirmation of the row just
      // written. Awaiting adds a round trip before closing the sheet or
      // navigating.
      queryClient.invalidateQueries({ queryKey: trackerQueryOptions.queryKey })
    },
    [queryClient, tracker.id]
  )

  const [form, setForm] = useState<FormState>(() => formStateFromTracker(tracker))
  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    setForm(formStateFromTracker(tracker))
  }, [tracker])

  const registryEntry = findRegistryEntry(tracker.baseUrl)
  const hasLoginPolicy = !!registryEntry?.rules?.loginIntervalDays

  const [proxyAvailable, setProxyAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open || proxyAvailable !== null) return
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setProxyAvailable(data ? !!data.proxyEnabled : false)
      })
      .catch(() => setProxyAvailable(false))
  }, [open, proxyAvailable])

  const [changingKey, setChangingKey] = useState(false)
  const [newApiToken, setNewApiToken] = useState("")
  const [editAvistazUsername, setEditAvistazUsername] = useState("")
  const [editAvistazCookies, setEditAvistazCookies] = useState("")
  const [editDcCookies, setEditDcCookies] = useState("")
  const [editIptCookies, setEditIptCookies] = useState("")
  const [editTlUsername, setEditTlUsername] = useState("")
  const [editTlPassword, setEditTlPassword] = useState("")

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const resetTransientState = useCallback(() => {
    setChangingKey(false)
    setNewApiToken("")
    setEditAvistazUsername("")
    setEditAvistazCookies("")
    setEditDcCookies("")
    setErrors({})
    setSaving(false)
    setDeleting(false)
  }, [])

  function handleClose() {
    resetTransientState()
    onClose()
  }

  async function handleSave(e: SyntheticEvent) {
    e.preventDefault()

    const validationErrors: Record<string, string> = {}
    if (!form.name.trim()) validationErrors.name = "Name is required"
    if (!form.baseUrl.trim()) {
      validationErrors.baseUrl = "Base URL is required"
    } else {
      try {
        new URL(form.baseUrl)
      } catch {
        validationErrors.baseUrl = "Invalid URL"
      }
    }
    if (changingKey && tracker.platformType === "digitalcore") {
      const trimmed = editDcCookies.trim()
      if (!trimmed) {
        validationErrors.apiToken = "Session cookies are required"
      } else {
        const hasUid = /(?:^|;\s*)uid=([^;]+)/.test(trimmed)
        const hasPass = /(?:^|;\s*)pass=([^;]+)/.test(trimmed)
        if (!hasUid || !hasPass) {
          validationErrors.apiToken = "Cookie string must contain both uid and pass values"
        }
      }
    } else if (changingKey && tracker.platformType === "iptorrents") {
      const trimmed = editIptCookies.trim().replace(/^Cookie:\s*/i, "")
      if (!trimmed) {
        validationErrors.apiToken = "Browser cookies are required"
      } else if (!trimmed.includes("=")) {
        validationErrors.apiToken = "Cookie string must contain key=value pairs"
      }
    } else if (changingKey && tracker.platformType === "torrentleech") {
      if (!editTlUsername.trim() || !editTlPassword) {
        validationErrors.apiToken = "Username and password are required"
      }
    } else if (
      changingKey &&
      tracker.platformType !== "avistaz" &&
      !newApiToken.trim()
    ) {
      validationErrors.apiToken = "API token cannot be empty"
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setSaving(true)

    let trimmedToken = newApiToken.trim()

    if (changingKey && tracker.platformType === "avistaz") {
      if (!editAvistazUsername.trim() || !editAvistazCookies.trim()) {
        setErrors({ apiToken: "Username and cookies are required" })
        setSaving(false)
        return
      }
      trimmedToken = JSON.stringify({
        cookies: editAvistazCookies.trim(),
        userAgent: navigator.userAgent,
        username: editAvistazUsername.trim(),
      })
    } else if (changingKey && tracker.platformType === "iptorrents") {
      trimmedToken = JSON.stringify({
        cookies: editIptCookies.trim().replace(/^Cookie:\s*/i, ""),
        userAgent: navigator.userAgent,
      })
    } else if (changingKey && tracker.platformType === "torrentleech") {
      trimmedToken = JSON.stringify({
        username: editTlUsername.trim(),
        password: editTlPassword,
      })
    } else if (changingKey && tracker.platformType === "digitalcore") {
      const trimmed = editDcCookies.trim()
      const uidMatch = trimmed.match(/(?:^|;\s*)uid=([^;]+)/)
      const passMatch = trimmed.match(/(?:^|;\s*)pass=([^;]+)/)
      if (!uidMatch || !passMatch) {
        setErrors({ apiToken: "Cookie string must contain both uid and pass values" })
        setSaving(false)
        return
      }
      // The stored blob never reaches the client, so this rebuild cannot
      // preserve an existing UA. Omitting it reverts the tracker to the default.
      trimmedToken = JSON.stringify({
        uid: uidMatch[1].trim(),
        pass: passMatch[1].trim(),
        userAgent: navigator.userAgent,
      })
    }

    // Test the new API key before saving
    if (changingKey && trimmedToken) {
      try {
        const testRes = await fetch("/api/trackers/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: form.baseUrl.trim(),
            apiToken: trimmedToken,
            platformType: tracker.platformType,
          }),
        })
        if (!testRes.ok) {
          const testData = await testRes.json().catch(() => ({ error: "Connection failed" }))
          setErrors({ apiToken: (testData as { error?: string }).error ?? "Connection failed" })
          setSaving(false)
          return
        }
      } catch {
        setErrors({ apiToken: "Could not verify API key — check your connection" })
        setSaving(false)
        return
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      color: form.color,
      baseUrl: form.baseUrl.trim(),
      qbtTag: form.qbtTag.trim(),
      joinedAt: form.joinedAt || null,
      lastAccessAt: form.lastAccessAt || null,
      useProxy: form.useProxy,
      countCrossSeedUnsatisfied: form.countCrossSeedUnsatisfied,
      hideUnreadBadges: form.hideUnreadBadges,
      mouseholeUrl: form.mouseholeUrl.trim() || null,
    }

    if (changingKey && trimmedToken) {
      payload.apiToken = trimmedToken
    }

    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }))
        setErrors({ form: (data as { error?: string }).error ?? "Save failed" })
        setSaving(false)
        return
      }

      // PATCH /api/trackers/[id] returns the freshly-read row. This is the
      // post-write truth. No follow-up GET needed.
      const updated = (await res.json()) as TrackerSummary
      syncTrackerCache(updated)

      resetTransientState()
      onUpdated(updated)
      onClose()
    } catch {
      setErrors({ form: "Network error — please try again" })
      setSaving(false)
    }
  }

  async function handleArchive() {
    setSaving(true)
    setErrors({})
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tracker.isActive }),
      })

      // A non-ok response used to fall through silently. No error, no state
      // change, sheet stays open. The user sees "I clicked Archive and nothing
      // happened", indistinguishable from "it's slow".
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrors({
          form: (data as { error?: string }).error ?? "Failed to update archive status",
        })
        return
      }

      const updated = (await res.json()) as TrackerSummary
      syncTrackerCache(updated)
      onUpdated(updated)
      onClose()
    } catch {
      setErrors({ form: "Failed to update archive status" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/trackers/${tracker.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        // Same shared cache as archive. Without this, the deleted row renders
        // in the sidebar after router.push("/").
        syncTrackerCache(null)
        onClose()
        router.push("/")
      } else {
        setErrors({ form: "Failed to delete tracker" })
        setDeleting(false)
      }
    } catch {
      setErrors({ form: "Network error during delete" })
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Tracker Settings" busy={saving || deleting}>
      <div className="flex flex-col p-6 pb-8 gap-5">
        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Nickname"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Display name for this tracker"
            error={errors.name}
          />

          <Input
            label="Base URL"
            value={form.baseUrl}
            onChange={(e) => updateField("baseUrl", e.target.value)}
            placeholder="https://aither.cc"
            error={errors.baseUrl}
          />

          {/* API Key. Show status or change input. */}
          <div className="flex flex-col gap-1">
            <H2 className="uppercase tracking-wider">API Key</H2>
            {changingKey && tracker.platformType === "avistaz" ? (
              <div className="flex flex-col gap-2">
                <Input
                  label="Username"
                  autoComplete="off"
                  data-1p-ignore
                  value={editAvistazUsername}
                  onChange={(e) => setEditAvistazUsername(e.target.value)}
                  placeholder="Your username on this tracker"
                />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="edit-avistaz-cookies"
                    className="text-xs uppercase tracking-wider text-secondary font-mono"
                  >
                    Browser Cookies
                  </label>
                  <textarea
                    id="edit-avistaz-cookies"
                    autoComplete="off"
                    data-1p-ignore
                    value={editAvistazCookies}
                    onChange={(e) => setEditAvistazCookies(e.target.value)}
                    placeholder="Paste Cookie header from DevTools"
                    rows={3}
                    className="w-full rounded-nm-sm bg-control-bg px-3 py-2 text-sm text-primary border border-transparent focus:border-accent focus:outline-none font-mono resize-y"
                  />
                </div>
                <Notice message={errors.apiToken} />
                <Button
                  variant="minimal"
                  size="sm"
                  text="Cancel"
                  className="self-start"
                  onClick={() => {
                    setChangingKey(false)
                    setEditAvistazUsername("")
                    setEditAvistazCookies("")
                    setErrors({})
                  }}
                />
              </div>
            ) : changingKey && tracker.platformType === "iptorrents" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <label
                    htmlFor="edit-ipt-cookies"
                    className="text-xs uppercase tracking-wider text-secondary font-sans font-medium"
                  >
                    Browser Cookies
                  </label>
                  <InfoTip
                    content="Open DevTools (F12) → Network → any request to IPTorrents → copy the full Cookie header value."
                    size="sm"
                    docs={DOCS.ADDING_A_TRACKER}
                  />
                </div>
                <textarea
                  id="edit-ipt-cookies"
                  name="edit-ipt-cookies"
                  autoComplete="off"
                  data-1p-ignore
                  value={editIptCookies}
                  onChange={(e) => setEditIptCookies(e.target.value)}
                  placeholder="cf_clearance=...; uid=123456; pass=abc123..."
                  rows={3}
                  className="w-full rounded-md border border-subtle bg-surface px-3 py-2 text-sm font-mono"
                />
                <Notice message={errors.apiToken} />
                <Button
                  variant="minimal"
                  size="sm"
                  text="Cancel"
                  className="self-start"
                  onClick={() => {
                    setChangingKey(false)
                    setEditIptCookies("")
                    setErrors({})
                  }}
                />
              </div>
            ) : changingKey && tracker.platformType === "torrentleech" ? (
              <div className="flex flex-col gap-2">
                <Input
                  label="Username"
                  name="edit-tl-username"
                  autoComplete="off"
                  data-1p-ignore
                  value={editTlUsername}
                  onChange={(e) => setEditTlUsername(e.target.value)}
                />
                <Input
                  label="Password"
                  name="edit-tl-password"
                  type="password"
                  autoComplete="off"
                  data-1p-ignore
                  value={editTlPassword}
                  onChange={(e) => setEditTlPassword(e.target.value)}
                />
                <Notice message={errors.apiToken} />
                <Button
                  variant="minimal"
                  size="sm"
                  text="Cancel"
                  className="self-start"
                  onClick={() => {
                    setChangingKey(false)
                    setEditTlUsername("")
                    setEditTlPassword("")
                    setErrors({})
                  }}
                />
              </div>
            ) : changingKey && tracker.platformType === "digitalcore" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <label
                    htmlFor="edit-dc-cookies"
                    className="text-xs uppercase tracking-wider text-secondary font-sans font-medium"
                  >
                    Session Cookies
                  </label>
                  <InfoTip
                    content="Open DevTools (F12) → Network → any request → copy the Cookie header value."
                    size="sm"
                    docs={DOCS.ADDING_A_TRACKER}
                  />
                </div>
                <textarea
                  id="edit-dc-cookies"
                  autoComplete="off"
                  data-1p-ignore
                  value={editDcCookies}
                  onChange={(e) => setEditDcCookies(e.target.value)}
                  placeholder="uid=56954; pass=abc123def456..."
                  rows={2}
                  className="w-full font-mono text-sm text-primary bg-control-bg rounded-nm-md px-4 py-3 placeholder:text-muted nm-inset focus:outline-none focus:nm-inset border-0 resize-y"
                />
                <Notice message={errors.apiToken} />
                <Button
                  variant="minimal"
                  size="sm"
                  text="Cancel"
                  className="self-start"
                  onClick={() => {
                    setChangingKey(false)
                    setEditDcCookies("")
                    setErrors({})
                  }}
                />
              </div>
            ) : changingKey ? (
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  data-1p-ignore
                  value={newApiToken}
                  onChange={(e) => setNewApiToken(e.target.value)}
                  placeholder="Paste API token"
                  error={errors.apiToken}
                />
                <Button
                  variant="minimal"
                  size="sm"
                  text="Cancel"
                  className="self-start"
                  onClick={() => {
                    setChangingKey(false)
                    setNewApiToken("")
                    setEditAvistazUsername("")
                    setEditAvistazCookies("")
                    setErrors({})
                  }}
                />
              </div>
            ) : (
              <MaskedSecret onChangeClick={() => setChangingKey(true)} />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="qBittorrent Tag"
              value={form.qbtTag}
              onChange={(e) => updateField("qbtTag", e.target.value)}
              placeholder="i.e, aither"
            />
            <QbtTagWarning tag={form.qbtTag} />
          </div>

          {tracker.platformType === "mam" && (
            <div className="flex items-center gap-1">
              <Input
                label="Mousehole URL (optional)"
                value={form.mouseholeUrl}
                onChange={(e) => updateField("mouseholeUrl", e.target.value)}
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
          )}

          <ColorPicker label="Color" value={form.color} onChange={(v) => updateField("color", v)} />

          {!(
            registryEntry?.gazelleEnrich ||
            tracker.platformType === "ggn" ||
            tracker.platformType === "avistaz" ||
            tracker.platformType === "digitalcore" ||
            tracker.platformType === "iptorrents" ||
            tracker.platformType === "torrentleech"
          ) && (
            <div>
              <label
                htmlFor="settings-joined-at"
                className="text-xs font-sans font-medium text-secondary uppercase tracking-wider mb-1 block"
              >
                Join Date
              </label>
              <input
                id="settings-joined-at"
                type="date"
                value={form.joinedAt}
                max={localDateStr()}
                onChange={(e) => updateField("joinedAt", e.target.value)}
                className={clsx(
                  "w-full font-mono text-sm text-primary cursor-pointer border-0",
                  "bg-control-bg px-4 py-3 nm-inset focus:outline-none rounded-nm-md",
                  !form.joinedAt && "text-muted"
                )}
                style={{ colorScheme: "dark" }}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1 gap-2">
              <label
                htmlFor="settings-last-access-at"
                className="text-xs font-sans font-medium text-secondary uppercase tracking-wider"
              >
                Last Login
              </label>
              {/* Fills the date field only. Save still writes it. Unsaved edits
                  survive. */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateField("lastAccessAt", localDateStr())}
                disabled={saving || deleting}
                text="Today"
              />
            </div>
            <input
              id="settings-last-access-at"
              type="date"
              value={form.lastAccessAt}
              max={localDateStr()}
              onChange={(e) => updateField("lastAccessAt", e.target.value)}
              className={clsx(
                "w-full font-mono text-sm text-primary cursor-pointer border-0",
                "bg-control-bg px-4 py-3 nm-inset focus:outline-none rounded-nm-md",
                !form.lastAccessAt && "text-muted"
              )}
              style={{ colorScheme: "dark" }}
            />
            <p className="text-xs font-sans text-muted mt-1">
              {tracker.lastAccessAt ? `Currently recorded: ${tracker.lastAccessAt}` : "Not recorded yet."}
              {!hasLoginPolicy &&
                " This tracker has no login-interval policy, so no dashboard timer will appear — this is for your own records."}
            </p>
          </div>

          <Toggle
            label="Use proxy"
            checked={form.useProxy}
            onChange={(v) => updateField("useProxy", v)}
            disabled={!proxyAvailable || proxyAvailable === null}
            description={
              proxyAvailable
                ? "Route API requests for this tracker through the global proxy configured in Settings."
                : "No proxy configured. Enable a proxy in Settings first."
            }
          />

          <Toggle
            label="Count cross-seed towards unsatisfieds"
            checked={form.countCrossSeedUnsatisfied}
            onChange={(v) => updateField("countCrossSeedUnsatisfied", v)}
            description="Include cross-seeded torrents when calculating unsatisfied download requirements."
          />

          {(tracker.platformType === "mam" || tracker.platformType === "gazelle") && (
            <Toggle
              checked={form.hideUnreadBadges}
              onChange={(v) => updateField("hideUnreadBadges", v)}
              label="Hide unread badges"
              description="Don't show inbox/notification counts on this tracker's detail page"
            />
          )}

          <Notice message={errors.form} />

          {/* Save / Cancel */}
          <div className="flex gap-3 pt-1 justify-end">
            <Button variant="ghost" onClick={handleClose} text="Cancel" />
            <Button type="submit" disabled={saving} text={saving ? "Saving..." : "Save Changes"} />
          </div>
        </form>

        {/* Danger zone */}
        <div className="border-t border-border pt-5 mt-1 flex flex-col gap-3">
          <span className="text-xs font-sans font-medium text-danger uppercase tracking-wider">
            Danger Zone
          </span>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleArchive}
              disabled={saving}
              text={tracker.isActive ? "Archive" : "Reactivate"}
            />

            <ConfirmRemove
              label="Delete"
              confirmLabel="Confirm Delete"
              busyLabel="Deleting..."
              busy={deleting}
              onConfirm={handleDelete}
            />
          </div>
        </div>
      </div>
    </Sheet>
  )
}

export { TrackerSettingsSheet }
