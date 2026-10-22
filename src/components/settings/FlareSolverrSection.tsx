// src/components/settings/FlareSolverrSection.tsx
"use client"

import { Subtext } from "@typography"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Badge, Button, Input, NumberInput, SaveDiscardBar } from "@/components/ui"
import { useActionStatus } from "@/hooks/useActionStatus"
import { usePatchSettings } from "@/hooks/usePatchSettings"
import { DOCS } from "@/lib/constants"
import { extractApiError } from "@/lib/extract-api-error"
import {
  FLARESOLVERR_TIMEOUT_DEFAULT_MS,
  FLARESOLVERR_TIMEOUT_MAX_MS,
  FLARESOLVERR_TIMEOUT_MIN_MS,
} from "@/lib/limits"

export interface FlareSolverrSectionProps {
  initialUrl: string
  /** Milliseconds, or null for the default */
  initialMaxTimeout: number | null
}

const toSeconds = (ms: number | null) => Math.round((ms ?? FLARESOLVERR_TIMEOUT_DEFAULT_MS) / 1000)

export function FlareSolverrSection({ initialUrl, initialMaxTimeout }: FlareSolverrSectionProps) {
  const [url, setUrl] = useState(initialUrl)
  const [seconds, setSeconds] = useState(toSeconds(initialMaxTimeout))
  const [saved, setSaved] = useState({ url: initialUrl, seconds: toSeconds(initialMaxTimeout) })
  const { saving, error, success, patch, clearSuccess } = usePatchSettings()
  const test = useActionStatus({ autoResetMs: false })
  const [testedVersion, setTestedVersion] = useState<string | null>(null)

  const dirty = url.trim() !== saved.url || seconds !== saved.seconds

  function handleTest() {
    setTestedVersion(null)
    test.execute(async () => {
      const res = await fetch("/api/settings/flaresolverr-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      })
      if (!res.ok) throw new Error(await extractApiError(res, "FlareSolverr test failed"))
      const data = (await res.json()) as { version?: string | null }
      setTestedVersion(data.version ?? null)
    })
  }

  async function handleSave() {
    const result = await patch({
      flaresolverrUrl: url.trim() || null,
      flaresolverrMaxTimeout: seconds * 1000,
    })
    if (!result.ok) return
    const data = result.data as {
      flaresolverrUrl: string | null
      flaresolverrMaxTimeout: number | null
    }
    const next = {
      url: data.flaresolverrUrl ?? "",
      seconds: toSeconds(data.flaresolverrMaxTimeout),
    }
    setSaved(next)
    setUrl(next.url)
    setSeconds(next.seconds)
  }

  return (
    <SettingsSection
      id="flaresolverr"
      title="FlareSolverr"
      tooltip="Read trackers behind a Cloudflare challenge through FlareSolverr."
      docs={DOCS.FLARESOLVERR}
      cardClassName="flex flex-col gap-5"
    >
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Input
            label="URL"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              clearSuccess()
              test.reset()
            }}
            placeholder="http://flaresolverr:8191"
          />
        </div>
        <NumberInput
          label="Max timeout (s)"
          value={seconds}
          onChange={(v) => {
            setSeconds(v)
            clearSuccess()
          }}
          min={FLARESOLVERR_TIMEOUT_MIN_MS / 1000}
          max={FLARESOLVERR_TIMEOUT_MAX_MS / 1000}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleTest}
          loading={test.status === "pending"}
          disabled={!url.trim()}
        >
          Test
        </Button>
        {test.status === "success" && (
          <Badge variant="success">
            FlareSolverr ready{testedVersion ? ` (${testedVersion})` : ""}
          </Badge>
        )}
        {test.status === "failed" && <Badge variant="danger">{test.error ?? "Unreachable"}</Badge>}
      </div>

      <Subtext>
        Trackers opt in one by one with Use FlareSolverr in their settings. Their pages then come
        from FlareSolverr&apos;s browser, which replaces the proxy for them.
      </Subtext>

      <SaveDiscardBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => {
          setUrl(saved.url)
          setSeconds(saved.seconds)
        }}
        error={error}
        success={success ? "FlareSolverr settings saved." : null}
        saveLabel="Save FlareSolverr"
        justify="end"
        showDivider={false}
      />
    </SettingsSection>
  )
}
