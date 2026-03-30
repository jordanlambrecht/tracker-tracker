// src/components/settings/PrivacySection.tsx
"use client"

import { Paragraph } from "@typography"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button } from "@/components/ui/Button"
import { ConfirmAction } from "@/components/ui/ConfirmAction"
import { Notice } from "@/components/ui/Notice"
import { RedactedText } from "@/components/ui/RedactedText"
import { Toggle } from "@/components/ui/Toggle"
import { usePatchSettings } from "@/hooks/usePatchSettings"

type ScrubState = "idle" | "confirming" | "scrubbing"

export interface PrivacySectionProps {
  initialStoreUsernames: boolean
}

export function PrivacySection({ initialStoreUsernames }: PrivacySectionProps) {
  const [storeUsernames, setStoreUsernames] = useState(initialStoreUsernames)
  const [scrubState, setScrubState] = useState<ScrubState>("idle")
  const { saving, error, patch: patchPrivacy } = usePatchSettings()

  async function patchSettings(payload: { storeUsernames: boolean; scrubExisting?: boolean }) {
    const result = await patchPrivacy(payload)
    if (result !== null) {
      setStoreUsernames((result as { storeUsernames: boolean }).storeUsernames)
    }
    setScrubState("idle")
  }

  function handleToggle(checked: boolean) {
    if (checked) {
      patchSettings({ storeUsernames: true })
    } else {
      setScrubState("confirming")
    }
  }

  function handleScrubYes() {
    setScrubState("scrubbing")
    patchSettings({ storeUsernames: false, scrubExisting: true })
  }

  function handleScrubNo() {
    setScrubState("idle")
    patchSettings({ storeUsernames: false })
  }

  function handleScrubCancel() {
    setScrubState("idle")
  }

  return (
    <SettingsSection id="privacy" title="Privacy" cardClassName="flex flex-col gap-5">
      <Toggle
        label="Store tracker usernames"
        checked={storeUsernames}
        onChange={handleToggle}
        disabled={saving || scrubState === "scrubbing"}
        description="When disabled, tracker usernames and user classes are replaced with redacted markers before being saved to the database."
      />

      {!storeUsernames && (
        <div className="flex items-center gap-3 text-xs font-mono text-tertiary">
          <span>Preview:</span>
          <RedactedText value="▓8" color="var(--color-accent)" />
        </div>
      )}

      {scrubState === "confirming" && (
        <ConfirmAction
          colorScheme="warn"
          message="Also scrub existing usernames from historical data?"
          confirmLabel="Yes, scrub history"
          onConfirm={handleScrubYes}
          onCancel={handleScrubCancel}
          additionalActions={
            <Button size="sm" variant="primary" onClick={handleScrubNo} text="No, keep history" />
          }
        >
          <Paragraph>
            This will permanently replace all stored usernames and user classes with redacted
            markers. This cannot be undone.
          </Paragraph>
        </ConfirmAction>
      )}

      {scrubState === "scrubbing" && (
        <Notice variant="warn" message="Scrubbing historical data..." />
      )}

      <Notice
        variant="info"
        message="This does not provide strong anonymization. Character count and other data points may still allow correlation. For full protection, deploy on an encrypted filesystem."
      />

      <Notice message={error} />
    </SettingsSection>
  )
}
