// src/components/dashboard/RetentionPromptDialog.tsx
//
// First-run prompt for the snapshot retention policy.
//
// This used to sit on the account-creation form, which is the wrong moment: the
// user is asked how long to keep snapshots before a single snapshot exists, so
// they have no basis to answer. Here they have at least seen the dashboard.
//
// It is also the natural place to reconcile the retention asymmetry. Download
// client uptime data prunes at 90 days regardless of this setting, so a user who
// picks "keep forever" should not be left believing everything is kept forever.

"use client"

import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { Toggle } from "@/components/ui/Toggle"
import { Subtext } from "@/components/ui/Typography"
import {
  SNAPSHOT_RETENTION_DEFAULT,
  SNAPSHOT_RETENTION_MAX,
  SNAPSHOT_RETENTION_MIN,
} from "@/lib/limits"

interface RetentionPromptDialogProps {
  open: boolean
  /** Called once the choice has been persisted. */
  onSaved: () => void
}

function RetentionPromptDialog({ open, onSaved }: RetentionPromptDialogProps) {
  const [prune, setPrune] = useState(false)
  const [days, setDays] = useState(SNAPSHOT_RETENTION_DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const daysId = useId()

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/settings/retention-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotRetentionDays: prune ? days : null }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error || "Could not save your choice. Try again.")
        return
      }
      onSaved()
    } catch {
      setError("Network error — could not save your choice.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      // No dismissal: closing without answering would re-prompt on every load,
      // which is more annoying than asking once. onClose is required by Dialog.
      onClose={() => {}}
      busy
      title="How long should snapshot history be kept?"
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <Subtext>
          Every poll stores a snapshot of your tracker stats. These power the charts and history —
          keeping them costs a small amount of database space.
        </Subtext>

        <Toggle
          label="Prune old snapshots automatically"
          description={
            prune
              ? `Snapshots older than ${days} days will be deleted.`
              : "Snapshots are kept forever. Nothing is ever deleted automatically."
          }
          checked={prune}
          onChange={setPrune}
          disabled={saving}
        />

        {prune && (
          <Input
            id={daysId}
            label="Keep snapshots for (days)"
            type="number"
            min={SNAPSHOT_RETENTION_MIN}
            max={SNAPSHOT_RETENTION_MAX}
            value={String(days)}
            onChange={(e) =>
              setDays(
                Math.max(
                  SNAPSHOT_RETENTION_MIN,
                  Math.min(SNAPSHOT_RETENTION_MAX, Number(e.target.value) || SNAPSHOT_RETENTION_DEFAULT)
                )
              )
            }
            disabled={saving}
          />
        )}

        <Subtext>
          Download client uptime data is pruned after 90 days either way — that limit is separate and
          is not affected by this choice.
        </Subtext>

        <Notice message={error ?? undefined} />

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={save}
            disabled={saving}
            text={saving ? "Saving…" : "Save"}
          />
        </div>

        <Subtext>You can change this at any time in Settings.</Subtext>
      </div>
    </Dialog>
  )
}

/**
 * Container: asks the server whether the question has been answered yet, and
 * shows the dialog only if it has not. Self-contained so mounting it is one line.
 *
 * Fails closed — if the check errors, nothing is shown. An unanswered prompt is a
 * far smaller problem than a modal the user cannot dismiss appearing on a broken
 * connection.
 */
function RetentionPrompt() {
  const [needed, setNeeded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch("/api/settings/retention-prompt", {
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return
        const data = (await res.json()) as { prompted: boolean }
        if (!cancelled && !data.prompted) setNeeded(true)
      } catch {
        // Fail closed: leave the prompt hidden.
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  if (!needed) return null
  return <RetentionPromptDialog open onSaved={() => setNeeded(false)} />
}

// RetentionPromptDialog and its props stay private: RetentionPrompt is the only
// consumer, and knip cannot flag an export used solely inside its own file
// (knip.json sets ignoreExportsUsedInFile), so a public one would never be caught.
export { RetentionPrompt }
