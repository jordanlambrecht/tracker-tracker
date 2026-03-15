// src/components/settings/DataSection.tsx
//
// Functions: DataSection

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Select } from "@/components/ui/Select"
import { H2, H3, Paragraph } from "@typography"
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
    if (result !== null) {
      setSavedPollInterval((result as { trackerPollIntervalMinutes: number }).trackerPollIntervalMinutes)
    }
  }

  return (
    <section aria-labelledby="data-heading">
      <H2 id="data-heading" className="mb-4">Data</H2>

      <Card elevation="raised">
        {/* Poll interval */}
        <div className="flex flex-col gap-3 ">
          <H3>Tracker Poll Interval</H3>
          <Paragraph>
            How often all trackers are polled for new stats. All trackers
            poll on the same schedule to keep data points aligned.
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
            className="max-w-48 "
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
          {pollIntervalError && (
            <p className="text-xs font-sans text-danger" role="alert">{pollIntervalError}</p>
          )}
          {pollIntervalSuccess && (
            <p className="text-xs font-sans text-success">Poll interval saved.</p>
          )}
          {pollInterval !== savedPollInterval && (
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={savingPollInterval}
                onClick={handleSavePollInterval}
              >
                {savingPollInterval ? "Saving…" : "Save Interval"}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </section>
  )
}
