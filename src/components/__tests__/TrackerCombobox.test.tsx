// src/components/__tests__/TrackerCombobox.test.tsx
//
// A tracker already added stays in the list but can't be picked, so the arrow
// keys must never leave the highlight on one, where Enter would do nothing.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TrackerCombobox } from "@/components/TrackerCombobox"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"

const entry = (slug: string) => ({ slug, name: slug.toUpperCase() }) as TrackerRegistryEntry

async function pickWith(slugs: string[], heldSlugs: string[], keys: string) {
  const onChange = vi.fn()
  const held = new Map(heldSlugs.map((slug) => [slug, true]))
  render(<TrackerCombobox presets={slugs.map(entry)} held={held} value="" onChange={onChange} />)
  await userEvent.click(screen.getByRole("textbox"))
  await userEvent.keyboard(`${keys}{Enter}`)
  return onChange
}

describe("TrackerCombobox keyboard", () => {
  it("starts on the first tracker that can be picked", async () => {
    const onChange = await pickWith(["aither", "blutopia"], ["aither"], "")
    expect(onChange).toHaveBeenCalledWith("blutopia")
  })

  it("steps down over a tracker already added", async () => {
    const onChange = await pickWith(["aither", "blutopia", "cathode"], ["blutopia"], "{ArrowDown}")
    expect(onChange).toHaveBeenCalledWith("cathode")
  })

  it("steps back up over a tracker already added", async () => {
    const onChange = await pickWith(
      ["aither", "blutopia", "cathode", "digitalcore"],
      ["cathode"],
      "{ArrowDown}{ArrowDown}{ArrowUp}"
    )
    expect(onChange).toHaveBeenCalledWith("blutopia")
  })

  it("stays on the last tracker that can be picked when only held ones follow", async () => {
    const onChange = await pickWith(["aither", "blutopia"], ["blutopia"], "{ArrowDown}")
    expect(onChange).toHaveBeenCalledWith("aither")
  })

  it("picks nothing when every tracker is already added", async () => {
    const onChange = await pickWith(["aither", "blutopia"], ["aither", "blutopia"], "{ArrowDown}")
    expect(onChange).not.toHaveBeenCalled()
  })
})
