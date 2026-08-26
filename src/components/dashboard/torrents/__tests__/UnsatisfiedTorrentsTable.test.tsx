// src/components/dashboard/torrents/__tests__/UnsatisfiedTorrentsTable.test.tsx
//
// What the Unsatisfied table renders for each shape of tracker rule, and the two
// bad-number cases that previously rendered a torrent as finished.
//
// Functions:
//   makeTorrent  - Build a TorrentRaw with everything zeroed
//   progressBar  - The name cell's bar, the only element with an inline width
//   barColor     - That bar's background-color, as jsdom reports it

import { render, screen, within } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"
import { UnsatisfiedTorrentsTable } from "@/components/dashboard/torrents/UnsatisfiedTorrentsTable"
import type { TorrentRaw } from "@/lib/fleet"
import type { SatisfactionRequirement } from "@/lib/satisfaction"

const HOUR = 3600

// MarqueeText builds a ResizeObserver in an effect and jsdom has none, so the
// render throws before any assertion runs. Nothing here depends on it firing:
// scrollWidth and clientWidth are both 0 in jsdom, so the text never overflows
// and the name renders exactly once.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const DANGER = "rgb(239, 68, 68)"
const POSITIVE = "rgb(34, 197, 94)"

function makeTorrent(overrides: Partial<TorrentRaw> = {}): TorrentRaw {
  return {
    hash: "h1",
    name: "Some.Torrent.Name",
    state: "stalledUP",
    tags: "",
    category: "",
    uploaded: 0,
    downloaded: 0,
    ratio: 0,
    size: 1_073_741_824,
    seedingTime: 0,
    activeTime: 0,
    addedAt: 0,
    completedAt: 0,
    lastActivityAt: 0,
    remaining: 0,
    seedCount: 0,
    leechCount: 0,
    swarmSeeders: 0,
    swarmLeechers: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
    availability: 0,
    progress: 1,
    clientName: "qbt",
    ...overrides,
  }
}

const SEED_ONLY: SatisfactionRequirement = {
  requiredSeedSeconds: 240 * HOUR,
  requiredRatio: null,
  mode: "all",
}
const RATIO_ONLY: SatisfactionRequirement = {
  requiredSeedSeconds: null,
  requiredRatio: 1.0,
  mode: "any",
}
const EITHER_OR: SatisfactionRequirement = {
  requiredSeedSeconds: 240 * HOUR,
  requiredRatio: 1.0,
  mode: "any",
}
const BOTH_REQUIRED: SatisfactionRequirement = {
  requiredSeedSeconds: 72 * HOUR,
  requiredRatio: 1.0,
  mode: "all",
}

function renderTable(requirement: SatisfactionRequirement, torrents: TorrentRaw[]) {
  return render(
    <UnsatisfiedTorrentsTable torrents={torrents} requirement={requirement} accentColor="#38bdf8" />
  )
}

/** The bar is the only element carrying an inline width. */
function progressBar(container: HTMLElement): HTMLElement {
  const withWidth = [...container.querySelectorAll<HTMLElement>("div[style]")].filter(
    (el) => el.style.width !== ""
  )
  expect(withWidth, "exactly one progress bar per rendered row").toHaveLength(1)
  return withWidth[0]
}

function barColor(container: HTMLElement): string {
  return progressBar(container).style.backgroundColor
}

function headers(): string[] {
  return screen.getAllByRole("columnheader").map((th) => th.textContent?.trim() ?? "")
}

describe("UnsatisfiedTorrentsTable columns", () => {
  it("omits the Ratio column when ratio is not part of the rule", () => {
    renderTable(SEED_ONLY, [makeTorrent()])
    expect(headers()).toEqual(["Name", "Size", "Seed Time", "Remaining"])
  })

  it("omits the Seed Time column when seed time is not part of the rule", () => {
    renderTable(RATIO_ONLY, [makeTorrent()])
    expect(headers()).toEqual(["Name", "Size", "Ratio", "Remaining"])
  })

  it("shows both when the rule names both", () => {
    renderTable(EITHER_OR, [makeTorrent()])
    expect(headers()).toEqual(["Name", "Size", "Seed Time", "Ratio", "Remaining"])
  })
})

describe("UnsatisfiedTorrentsTable empty states", () => {
  it("names both routes under an either/or", () => {
    renderTable(EITHER_OR, [])
    expect(screen.getByText("All torrents meet the seed time or ratio requirement")).toBeVisible()
  })

  it("names ratio alone for a ratio-only rule", () => {
    renderTable(RATIO_ONLY, [])
    expect(screen.getByText("All torrents meet ratio requirements")).toBeVisible()
  })

  it("names seed time alone for a seed-time-only rule", () => {
    renderTable(SEED_ONLY, [])
    expect(screen.getByText("All torrents meet seed time requirements")).toBeVisible()
  })

  it("names seed time for an and-both rule, since neither route alone releases it", () => {
    renderTable(BOTH_REQUIRED, [])
    expect(screen.getByText("All torrents meet seed time requirements")).toBeVisible()
  })
})

describe("UnsatisfiedTorrentsTable remaining column", () => {
  it("quotes seed time when that is the only route", () => {
    renderTable(SEED_ONLY, [makeTorrent({ seedingTime: 40 * HOUR })])
    // 240h required, 40h served, 200h left = 8.3 days
    expect(screen.getByText("8.3d")).toBeVisible()
  })

  it("quotes the ratio still owed when that is the only route", () => {
    renderTable(RATIO_ONLY, [makeTorrent({ ratio: 0.4 })])
    expect(screen.getByText("0.60 ratio")).toBeVisible()
  })

  it("quotes ratio under an either/or when ratio is the nearer route", () => {
    // 25% of the seed time but 90% of the ratio. Telling someone 7 days when an
    // hour of seeding would clear it is what sends them to delete the torrent.
    renderTable(EITHER_OR, [makeTorrent({ seedingTime: 60 * HOUR, ratio: 0.9 })])
    expect(screen.getByText("0.10 ratio")).toBeVisible()
  })

  it("takes the seed-time branch when both routes are exactly tied", () => {
    // Pins the strict > in the branch selector: a tie is not "ratio is nearer".
    // 25 percent on both routes, so the served time (2.5d) and the remaining
    // time (7.5d) render as different strings.
    renderTable(EITHER_OR, [makeTorrent({ seedingTime: 60 * HOUR, ratio: 0.25 })])
    expect(screen.getByText("7.5d")).toBeVisible()
    expect(screen.queryByText("0.75 ratio")).toBeNull()
  })

  it("quotes seed time under an either/or when seed time is the nearer route", () => {
    renderTable(EITHER_OR, [makeTorrent({ seedingTime: 200 * HOUR, ratio: 0.1 })])
    expect(screen.getByText("1.7d")).toBeVisible()
  })
})

describe("UnsatisfiedTorrentsTable progress", () => {
  it("reports the nearer route under an either/or", () => {
    renderTable(EITHER_OR, [makeTorrent({ seedingTime: 60 * HOUR, ratio: 0.9 })])
    expect(screen.getByText("90%")).toBeVisible()
  })

  it("reports the laggard when both are required", () => {
    renderTable(BOTH_REQUIRED, [makeTorrent({ seedingTime: 72 * HOUR, ratio: 0.3 })])
    expect(screen.getByText("30%")).toBeVisible()
  })
})

// Both of these rendered a torrent as finished inside a table of unfinished ones.
describe("UnsatisfiedTorrentsTable bad numbers", () => {
  it("shows no progress for a torrent whose seed time is missing", () => {
    // seeding_time is absent from a client response, so the division yields NaN.
    // NaN loses every comparison: the percentage read a dash, `width: NaN%` is
    // invalid CSS and was dropped so the bar filled, and NaN fell past both
    // thresholds in the colour ramp to green.
    const { container } = renderTable(EITHER_OR, [
      makeTorrent({ seedingTime: undefined as unknown as number }),
    ])
    expect(screen.getByText("0%")).toBeVisible()
    expect(progressBar(container).style.width).toBe("0%")
    expect(barColor(container)).toBe(DANGER)
    expect(barColor(container)).not.toBe(POSITIVE)
    // The full 240h is owed. The raw NaN rendered this cell as "Done" on a
    // torrent the same row marks 0% complete.
    expect(screen.getByText("10.0d")).toBeVisible()
    expect(screen.queryByText("Done")).toBeNull()
  })

  it("shows no progress for a NaN seed time", () => {
    const { container } = renderTable(SEED_ONLY, [makeTorrent({ seedingTime: Number.NaN })])
    expect(progressBar(container).style.width).toBe("0%")
    expect(barColor(container)).toBe(DANGER)
  })

  it("scores qBittorrent's -1 infinite-ratio sentinel as no progress", () => {
    // -1 means the torrent downloaded nothing, i.e. a pure cross-seed. Whether
    // that satisfies a 1:1 rule is a hit-and-run judgement nobody has made, so
    // it clears on seed time instead. See the sentinel note in fleet-aggregation.
    const { container } = renderTable(RATIO_ONLY, [makeTorrent({ ratio: -1 })])
    expect(progressBar(container).style.width).toBe("0%")
    expect(barColor(container)).toBe(DANGER)
  })

  it("owes the full ratio for the -1 sentinel rather than inflating it", () => {
    // Subtracting -1 from the requirement reported "2.00 ratio" owed against a
    // 1.0 rule, a number that cannot occur.
    renderTable(RATIO_ONLY, [makeTorrent({ ratio: -1 })])
    expect(screen.getByText("1.00 ratio")).toBeVisible()
    expect(screen.queryByText("2.00 ratio")).toBeNull()
  })

  it("renders the -1 sentinel as an infinite ratio, not a negative one", () => {
    renderTable(RATIO_ONLY, [makeTorrent({ ratio: -1 })])
    expect(screen.getByText("∞")).toBeVisible()
    expect(screen.queryByText("-1.00")).toBeNull()
  })

  it("does not let a sentinel ratio release a torrent under an either/or", () => {
    const { container } = renderTable(EITHER_OR, [
      makeTorrent({ seedingTime: 24 * HOUR, ratio: -1 }),
    ])
    // 24h of 240h is 10%, and the ratio route contributes nothing.
    expect(screen.getByText("10%")).toBeVisible()
    expect(barColor(container)).toBe(DANGER)
  })
})

describe("UnsatisfiedTorrentsTable rows", () => {
  it("renders one row per torrent with its name and size", () => {
    renderTable(EITHER_OR, [
      makeTorrent({ hash: "a", name: "First.Release", size: 1_073_741_824 }),
      makeTorrent({ hash: "b", name: "Second.Release", size: 2_147_483_648 }),
    ])
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText("First.Release")).toBeVisible()
    expect(within(rows[0]).getByText("1.00 GiB")).toBeVisible()
    expect(within(rows[1]).getByText("Second.Release")).toBeVisible()
    expect(within(rows[1]).getByText("2.00 GiB")).toBeVisible()
  })
})
