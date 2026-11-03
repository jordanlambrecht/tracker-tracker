// src/components/__tests__/AddTrackerDialog.picker.test.tsx
//
// The picker leaves out a tracker that shut down. A tracker one of the user's
// rows already uses stays in the list, so searching for it says why it can't be
// picked, archived rows included.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { TRACKER_REGISTRY, type TrackerRegistryEntry } from "@/data/tracker-registry"

function entryWhere(what: string, test: (entry: TrackerRegistryEntry) => boolean) {
  const entry = TRACKER_REGISTRY.find(test)
  if (!entry) throw new Error(`the registry has no ${what} left to test with`)
  return entry
}

const LIVE = entryWhere("Aither entry", (e) => e.slug === "aither")
const DEFUNCT = entryWhere("defunct entry", (e) => Boolean(e.defunct))

const NONE_HELD: ReadonlyMap<string, boolean> = new Map()

function renderDialog(heldSlugs = NONE_HELD) {
  render(<AddTrackerDialog open heldSlugs={heldSlugs} onClose={vi.fn()} onAdded={vi.fn()} />)
}

async function search(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByPlaceholderText("Search trackers…")
  await user.clear(input)
  await user.type(input, text)
}

const startsWith = (name: string) => (accessible: string) => accessible.startsWith(name)

describe("AddTrackerDialog tracker picker", () => {
  it("leaves a tracker that shut down out of search", async () => {
    const user = userEvent.setup()
    renderDialog()

    await search(user, DEFUNCT.name)
    expect(screen.queryByRole("option", { name: startsWith(DEFUNCT.name) })).toBeNull()
    expect(screen.getByText("No matches")).toBeInTheDocument()

    await search(user, LIVE.name)
    expect(screen.getByRole("option", { name: startsWith(LIVE.name) })).toBeEnabled()
  })

  it.each([
    ["an active", true, "Already added"],
    ["an archived", false, "Already added (archived)"],
  ])("lists a tracker %s row uses as added and won't pick it", async (_holder, isActive, label) => {
    const user = userEvent.setup()
    renderDialog(new Map([[LIVE.slug, isActive]]))

    await search(user, LIVE.name)
    const held = screen.getByRole("option", { name: startsWith(LIVE.name) })
    expect(held).toBeDisabled()
    expect(within(held).getByText(label)).toBeInTheDocument()

    // It is the only match, so Enter tries it first.
    await user.keyboard("{Enter}")
    await user.click(held)

    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull()
  })
})
