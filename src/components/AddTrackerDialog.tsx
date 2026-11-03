// src/components/AddTrackerDialog.tsx
"use client"

import { H2, Subtext } from "@typography"
import clsx from "clsx"
import { useCallback, useEffect, useState } from "react"
import { CredentialFields } from "@/components/CredentialFields"
import { CHART_THEME } from "@/components/charts/lib/theme"
import { ADDABLE_TRACKERS, TrackerCombobox } from "@/components/TrackerCombobox"
import { Button } from "@/components/ui/Button"
import { ColorPicker } from "@/components/ui/ColorPicker"
import { Dialog } from "@/components/ui/Dialog"
import { InfoTip } from "@/components/ui/InfoTip"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { QbtTagWarning } from "@/components/ui/QbtTagWarning"
import { Toggle } from "@/components/ui/Toggle"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import { USE_PROXY_DESCRIPTION } from "@/lib/constants"
import {
  buildCredentialBlob,
  CREDENTIAL_FORMS,
  type CredentialValues,
  credentialFormFor,
  EMPTY_CREDENTIAL_VALUES,
  validateCredentialValues,
} from "@/lib/credential-forms"
import { localDateStr } from "@/lib/formatters"
import { MOUSEHOLE_TOKEN_TIP, MOUSEHOLE_URL_PLACEHOLDER, MOUSEHOLE_URL_TIP } from "@/lib/mousehole"

// ---------------------------------------------------------------------------
// AddTrackerDialog
// ---------------------------------------------------------------------------

interface AddTrackerDialogProps {
  open: boolean
  onClose: () => void
  onAdded: (trackerId: number) => void
  /** From useHeldTrackerSlugs. Required, so no caller can offer a tracker twice. */
  heldSlugs: ReadonlyMap<string, boolean>
}

function AddTrackerDialog({ open, onClose, onAdded, heldSlugs }: AddTrackerDialogProps) {
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
  // Null until the settings read answers. Until the toggle shows, nothing is
  // sent and the server's own default keeps a set-up proxy in use.
  const [proxyUsable, setProxyUsable] = useState<boolean | null>(null)
  const [useProxy, setUseProxy] = useState(true)

  const setCredentialField = useCallback((field: keyof CredentialValues, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }))
  }, [])

  useEffect(() => {
    if (!open || proxyUsable !== null) return
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProxyUsable(data?.proxyUsable === true))
      .catch(() => setProxyUsable(false))
  }, [open, proxyUsable])

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
    // Read again on the next open, since the proxy can be set up between adds.
    setProxyUsable(null)
    setUseProxy(true)
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
    // The test and the first poll take the same route.
    const proxyChoice = proxyUsable ? { useProxy } : {}

    try {
      const testRes = await fetch("/api/trackers/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedPreset,
          apiToken: effectiveApiToken,
          ...proxyChoice,
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
          ...proxyChoice,
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
            presets={ADDABLE_TRACKERS}
            held={heldSlugs}
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
            label="Client Tag"
            name="tracker-qbt-tag"
            autoComplete="off"
            data-1p-ignore
            value={qbtTag}
            onChange={(e) => setQbtTag(e.target.value)}
            placeholder={selectedEntry ? `i.e, ${selectedEntry.slug}` : "i.e, tracker-name"}
          />
          <Subtext>
            Optional. The qBittorrent tag or Transmission label on this tracker's torrents.
          </Subtext>
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

        {proxyUsable && (
          <Toggle
            label="Use proxy"
            checked={useProxy}
            onChange={setUseProxy}
            description={USE_PROXY_DESCRIPTION}
          />
        )}

        <Notice message={errors.form} />
      </div>
    </Dialog>
  )
}

export { AddTrackerDialog }
