// src/components/layout/ChangelogDialog.test.tsx
//
// The version number in the sidebar footer opens the full changelog. It is
// long prose, so it must open wide enough to read and its scroll area must
// carry the app's styled scrollbar, not the OS default.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/useUpdateCheck", () => ({
  useUpdateCheck: () => ({ latestVersion: null, updateAvailable: false }),
}))

vi.mock("@/hooks/useSidebarPreferences", () => ({
  useSidebarPreferences: () => ({
    sortMode: "manual",
    statMode: "ratio",
    showFavoritesOnly: false,
    showArchived: false,
    unlocked: false,
    filtersExpanded: false,
    setSortMode: vi.fn(),
    setStatMode: vi.fn(),
    setShowFavoritesOnly: vi.fn(),
    setShowArchived: vi.fn(),
    setUnlocked: vi.fn(),
    setFiltersExpanded: vi.fn(),
  }),
}))

vi.mock("@/hooks/useTrackerList", () => ({
  useTrackerList: () => ({
    trackers: [],
    loading: false,
    displayedTrackers: [],
    trackerIds: [],
    archivedCount: 0,
    toggleFavorite: vi.fn(),
    handleDragEnd: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock("@/hooks/useHeldTrackerSlugs", () => ({
  useHeldTrackerSlugs: () => new Set<string>(),
}))

vi.mock("@/components/layout/DownloadClientStatusWidget", () => ({
  DownloadClientStatusWidget: () => null,
}))

vi.mock("@/components/AddTrackerDialog", () => ({
  AddTrackerDialog: () => null,
}))

import { Sidebar } from "@/components/layout/Sidebar"

const CHANGELOG = [
  "## 2.15.1 (2026-10-31)",
  "",
  "### Bug Fixes",
  "",
  "* **api:** answer Prowlarr test failures with fixed messages",
  "",
].join("\n")

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "2.15.1")
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ content: CHANGELOG })))
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ChangelogContent comes through next/dynamic, and its first import can take
// seconds on a loaded machine, past findByText's 1 s default.
const CONTENT_IMPORT_WAIT_MS = 10_000

describe("ChangelogDialog", () => {
  it(
    "opens from the sidebar version number as a wide shared dialog with a styled scrollbar",
    async () => {
      render(<Sidebar collapsed={false} onToggle={vi.fn()} />)

      await userEvent.click(screen.getByRole("button", { name: "v2.15.1" }))

      const entry = await screen.findByText(/answer Prowlarr test failures/, undefined, {
        timeout: CONTENT_IMPORT_WAIT_MS,
      })
      const dialog = entry.closest("dialog")
      expect(dialog).not.toBeNull()

      const scrollArea = dialog?.querySelector(".overflow-y-auto")
      expect(scrollArea).toContainElement(entry)
      expect(scrollArea).toHaveClass("styled-scrollbar")

      const panel = scrollArea?.parentElement
      expect(panel).toHaveClass("max-w-2xl")
      expect(panel).not.toHaveClass("max-w-md")
    },
    2 * CONTENT_IMPORT_WAIT_MS
  )
})
