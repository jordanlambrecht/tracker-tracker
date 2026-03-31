// src/components/settings/DataSection.tsx
"use client"

import { H3, Paragraph } from "@typography"
import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { SaveDiscardBar, Select } from "@/components/ui"
import { usePatchSettings } from "@/hooks/usePatchSettings"

export interface DataSectionProps {
  initialPollInterval: number
}

export function DataSection({ initialPollInterval }: DataSectionProps) {
  const [pollInterval, setPollInterval] = useState(initialPollInterval)
  const [savedPollInterval, setSavedPollInterval] = useState(initialPollInterval)

  const {
    saving: savingPollInterval,
    error: pollIntervalError,
    success: pollIntervalSuccess,
    patch,
    clearSuccess,
  } = usePatchSettings()

  async function handleSavePollInterval() {
    const result = await patch({ trackerPollIntervalMinutes: pollInterval })
    if (result.ok) {
      setSavedPollInterval(
        (result.data as { trackerPollIntervalMinutes: number }).trackerPollIntervalMinutes
      )
    }
  }

  return (
    <SettingsSection id="data" title="Data">
      {/* Poll interval */}
      <div className="flex flex-col gap-3">
        <H3>Tracker Poll Interval</H3>
        <Paragraph>
          How often all trackers are polled for new stats. All trackers poll on the same schedule to
          keep data points aligned.
        </Paragraph>
        <Select
          value={String(pollInterval)}
          onChange={(v) => {
            setPollInterval(Number(v))
            clearSuccess()
          }}
          ariaLabel="Poll interval"
          label="Interval"
          size="md"
          className="max-w-48"
          options={[
            { value: "15", label: "15 min" },
            { value: "30", label: "30 min" },
            { value: "60", label: "1 hour" },
            { value: "180", label: "3 hours" },
            { value: "360", label: "6 hours" },
            { value: "720", label: "12 hours" },
            { value: "1440", label: "24 hours" },
          ]}
        />
        <SaveDiscardBar
          dirty={pollInterval !== savedPollInterval}
          saving={savingPollInterval}
          onSave={handleSavePollInterval}
          error={pollIntervalError}
          success={pollIntervalSuccess ? "Poll interval saved." : null}
          saveLabel="Save Interval"
          justify="end"
          showDivider={false}
        />
      </div>
    </SettingsSection>
  )
}
