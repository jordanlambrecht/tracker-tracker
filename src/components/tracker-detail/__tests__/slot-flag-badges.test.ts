// src/components/tracker-detail/__tests__/slot-flag-badges.test.ts
//
// Each flag badge reads one field of its platform's meta. It shows only at the
// flag's own value, and never for a missing field, a tracker with no meta, or a
// tracker on another platform.

import { describe, expect, it } from "vitest"
import { SLOT_DEFINITIONS } from "@/components/tracker-detail/slot-registry"
import type { SlotContext } from "@/types/slots"

function resolveBadge(id: string, platformType: string, meta: Record<string, unknown> | null) {
  const slot = SLOT_DEFINITIONS.find((s) => s.id === id)
  if (!slot) throw new Error(`no slot named ${id}`)
  const ctx = {
    tracker: { platformType },
    meta,
    latestSnapshot: null,
    registry: undefined,
    accentColor: "#00d4ff",
  } as unknown as SlotContext
  return slot.resolve(ctx)
}

// The badge, its platform, the field it reads, the value that shows it, and what shows.
const FLAG_BADGES: [string, string, string, boolean, Record<string, unknown>][] = [
  ["ggn-parked", "ggn", "parked", true, { label: "Parked" }],
  ["ggn-irc", "ggn", "onIRC", true, { variant: "default" }],
  ["avistaz-download-disabled", "avistaz", "canDownload", false, { label: "Downloads Disabled" }],
  ["avistaz-upload-disabled", "avistaz", "canUpload", false, { label: "Uploads Disabled" }],
  ["dc-download-ban", "digitalcore", "downloadBan", true, { label: "Download Ban" }],
  ["dc-upload-ban", "digitalcore", "uploadBan", true, { label: "Upload Ban" }],
  ["dc-hnr-warned", "digitalcore", "hnrWarned", true, { label: "HnR Warned" }],
  ["dc-parked", "digitalcore", "parked", true, { label: "Parked" }],
  ["dc-unconnectable", "digitalcore", "connectable", false, { label: "Not Connectable" }],
  ["dc-seedbox-donor", "digitalcore", "seedboxDonor", true, { label: "Seedbox Donor" }],
]

describe("flag badges", () => {
  it.each(FLAG_BADGES)("%s shows on %s when %s is %s", (id, platform, field, on, shown) => {
    expect(resolveBadge(id, platform, { [field]: on })).toMatchObject(shown)
  })

  it.each(FLAG_BADGES)("%s stays hidden otherwise", (id, platform, field, on) => {
    expect(resolveBadge(id, platform, { [field]: !on })).toBeNull()
    expect(resolveBadge(id, platform, {})).toBeNull()
    expect(resolveBadge(id, platform, null)).toBeNull()
    expect(resolveBadge(id, "unit3d", { [field]: on })).toBeNull()
  })
})
