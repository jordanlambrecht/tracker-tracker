// src/components/dashboard/__tests__/RankStacks.test.tsx
//
// The Ranks section draws one equal-height stack per tracker that has an
// earned class ladder in the registry. These pin the rules that decide which
// trackers appear, how many rungs each stack has, how many are lit, and what
// the stack says to assistive tech.

import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TrackerRegistryEntry, TrackerUserClass } from "@/data/tracker-registry"
import { REDACTED_PREFIX } from "@/lib/privacy"
import type { TrackerLatestStats, TrackerSummary } from "@/types/api"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const LADDERS: Record<string, TrackerUserClass[]> = {
  alpha: [
    { name: "Leech", requirements: "Ratio below 0.4", outsideLadder: "below" },
    { name: "User", requirements: "Ratio at or above 0.4" },
    { name: "Power User", requirements: "1 TiB uploaded" },
    { name: "VIP", requirements: "Donation", outsideLadder: "above" },
  ],
  beta: [],
  gamma: [
    { name: "User", requirements: "Default" },
    { name: "Elite", requirements: "5 TiB uploaded" },
  ],
}

vi.mock("@/data/tracker-registry", () => ({
  registryEntryFor: ({ registrySlug }: { registrySlug: string | null }) =>
    registrySlug && registrySlug in LADDERS
      ? ({ userClasses: LADDERS[registrySlug] } as unknown as TrackerRegistryEntry)
      : undefined,
}))

import { RankStacks } from "@/components/dashboard/RankStacks"

const baseStats: TrackerLatestStats = {
  ratio: 1,
  ratioIsInfinite: false,
  uploadedBytes: "0",
  downloadedBytes: "0",
  bufferBytes: null,
  seedingCount: null,
  leechingCount: null,
  requiredRatio: null,
  warned: null,
  freeleechTokens: null,
  hitAndRuns: null,
  seedbonus: null,
  shareScore: null,
  username: null,
  group: null,
}

function makeTracker(
  id: number,
  name: string,
  registrySlug: string | null,
  group: string | null,
  overrides: Partial<TrackerSummary> = {}
): TrackerSummary {
  return {
    id,
    name,
    // One address for every fixture: it is where the row polls, never how the
    // ladder is found.
    baseUrl: "https://poll-address.example",
    registrySlug,
    platformType: "unit3d",
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    lastErrorAt: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    qbtTag: null,
    mouseholeUrl: null,
    hasMouseholeToken: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    hideUnreadBadges: false,
    isFavorite: false,
    sortOrder: null,
    joinedAt: null,
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    latestStats: { ...baseStats, group },
    ...overrides,
  }
}

const alpha = makeTracker(1, "Alpha", "alpha", "power user")
const beta = makeTracker(2, "Beta", "beta", "Member")
const gamma = makeTracker(3, "Gamma", "gamma", null)

function stackFor(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${name}:`) })
}

function rungs(stack: HTMLElement): HTMLElement[] {
  return Array.from(stack.querySelectorAll<HTMLElement>("[data-rung]"))
}

function litCount(stack: HTMLElement): number {
  return rungs(stack).filter((r) => r.dataset.lit === "true").length
}

function renderStacks(trackers: TrackerSummary[], expanded = true) {
  return render(<RankStacks trackers={trackers} expanded={expanded} onToggleExpanded={() => {}} />)
}

beforeEach(() => {
  push.mockReset()
})

describe("RankStacks", () => {
  it("shows one stack per tracker with a ladder and skips the rest", () => {
    renderStacks([alpha, beta, gamma])
    expect(screen.getByText("Ranks")).toBeInTheDocument()
    expect(stackFor("Alpha")).toBeInTheDocument()
    expect(stackFor("Gamma")).toBeInTheDocument()
    expect(screen.queryByText("Beta")).not.toBeInTheDocument()
  })

  it("draws only the earned rungs and lights them up to the current class", () => {
    renderStacks([alpha, gamma])
    const a = stackFor("Alpha")
    // Leech sits below the ladder and VIP above it, so the rungs are User and Power User.
    expect(rungs(a)).toHaveLength(2)
    expect(litCount(a)).toBe(2)
    expect(within(a).getByText("Power User")).toBeInTheDocument()

    const g = stackFor("Gamma")
    expect(rungs(g)).toHaveLength(2)
    expect(litCount(g)).toBe(0)
    expect(within(g).getByText("—")).toBeInTheDocument()
  })

  it("lights a partial stack for a mid-ladder class, lowest rung first in the DOM", () => {
    renderStacks([makeTracker(4, "Delta", "alpha", "User")])
    const d = stackFor("Delta")
    expect(litCount(d)).toBe(1)
    expect(rungs(d).map((r) => r.dataset.lit)).toEqual(["true", "false"])
  })

  it("renders a class above the ladder as a full stack under its own name", () => {
    renderStacks([makeTracker(5, "Epsilon", "alpha", "VIP")])
    const e = stackFor("Epsilon")
    expect(rungs(e)).toHaveLength(2)
    expect(litCount(e)).toBe(2)
    expect(within(e).getByText("VIP")).toBeInTheDocument()
  })

  it("renders a demoted member as an empty stack under the demotion class", () => {
    renderStacks([makeTracker(7, "Theta", "alpha", "Leech")])
    const t = stackFor("Theta")
    expect(rungs(t)).toHaveLength(2)
    expect(litCount(t)).toBe(0)
    expect(within(t).getByText("Leech")).toBeInTheDocument()
  })

  it("marks a class the registry does not list instead of pretending it is a demotion", () => {
    renderStacks([makeTracker(8, "Zeta", "alpha", "Mystery")])
    const z = stackFor("Zeta")
    expect(litCount(z)).toBe(0)
    const label = within(z).getByText("Mystery")
    expect(label).toHaveClass("text-warn")
    expect(z).toHaveAttribute("aria-label", "Zeta: Mystery, not on the registry ladder")
  })

  it("speaks the class and rank in each stack's accessible name", () => {
    renderStacks([
      alpha,
      gamma,
      makeTracker(5, "Epsilon", "alpha", "VIP"),
      makeTracker(7, "Theta", "alpha", "Leech"),
    ])
    expect(stackFor("Alpha")).toHaveAttribute("aria-label", "Alpha: Power User, rank 2 of 2")
    expect(stackFor("Gamma")).toHaveAttribute(
      "aria-label",
      "Gamma: class not reported, rank 0 of 2"
    )
    expect(stackFor("Epsilon")).toHaveAttribute(
      "aria-label",
      "Epsilon: VIP, above the 2-rank ladder"
    )
    expect(stackFor("Theta")).toHaveAttribute("aria-label", "Theta: Leech, rank 0 of 2")
  })

  it("skips a row that names no registry entry", () => {
    // A pre-registry custom site has no ladder to draw, and its stored URL is
    // not a way to guess one.
    renderStacks([makeTracker(10, "Lambda", null, "Power User")])
    expect(screen.queryByRole("button", { name: /^Lambda:/ })).not.toBeInTheDocument()
  })

  it("renders nothing at all when no active tracker has a ladder", () => {
    const archived = makeTracker(6, "Iota", "alpha", "User", { isActive: false })
    const { container } = renderStacks([beta, archived])
    expect(container).toBeEmptyDOMElement()
  })

  it("keeps the toggle but hides the stacks when collapsed", () => {
    renderStacks([alpha], false)
    expect(screen.getByText("Ranks")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Alpha:/ })).not.toBeInTheDocument()
  })

  it("opens the tracker page when a stack is clicked", () => {
    renderStacks([alpha])
    fireEvent.click(stackFor("Alpha"))
    expect(push).toHaveBeenCalledWith("/trackers/1")
  })

  it("lists every rung with its requirements in one tooltip, highest first, marking yours", async () => {
    const user = userEvent.setup()
    renderStacks([makeTracker(4, "Delta", "alpha", "User")])
    await user.hover(stackFor("Delta"))
    const tip = screen.getByRole("tooltip")
    const text = tip.textContent ?? ""
    // Exactly one rung is marked, and it is the lower one. The requirements
    // strings are unique, so their order pins highest-first.
    expect(text.match(/\(you\)/g)).toHaveLength(1)
    expect(text).toContain("User (you)")
    expect(text).not.toContain("Power User (you)")
    expect(text.indexOf("1 TiB uploaded")).toBeLessThan(text.indexOf("Ratio at or above 0.4"))
    // Classes outside the ladder are not rungs and do not appear as such.
    expect(text).not.toContain("Leech")
    expect(text).not.toContain("VIP")
  })

  it("reaches the tooltip from the keyboard", async () => {
    const user = userEvent.setup()
    renderStacks([alpha])
    expect(screen.queryByRole("tooltip")).toBeNull()
    // The section toggle button comes first in tab order.
    await user.tab()
    await user.tab()
    expect(stackFor("Alpha")).toHaveFocus()
    expect(screen.getByRole("tooltip").textContent).toContain("Power User (you)")
  })

  it("names a class above the ladder at the top of its tooltip", async () => {
    const user = userEvent.setup()
    renderStacks([makeTracker(5, "Epsilon", "alpha", "VIP")])
    await user.hover(stackFor("Epsilon"))
    const text = screen.getByRole("tooltip").textContent ?? ""
    expect(text).toContain("VIP, above the ladder")
    // The top rung is lit for a VIP but it is not their class.
    expect(text).not.toContain("(you)")
  })

  it("explains an unlisted class in the tooltip with the same words it speaks", async () => {
    const user = userEvent.setup()
    renderStacks([makeTracker(8, "Zeta", "alpha", "Mystery")])
    await user.hover(stackFor("Zeta"))
    expect(screen.getByRole("tooltip").textContent).toContain("Mystery, not on the registry ladder")
  })

  it("opens a single tooltip for a redacted class and explains the mask inside it", async () => {
    const user = userEvent.setup()
    const masked = makeTracker(9, "Kappa", "alpha", `${REDACTED_PREFIX}5`)
    renderStacks([masked])
    const k = stackFor("Kappa")
    expect(k).toHaveAttribute("aria-label", "Kappa: class redacted, rank 0 of 2")
    await user.hover(within(k).getByRole("img"))
    const tips = screen.getAllByRole("tooltip")
    expect(tips).toHaveLength(1)
    expect(tips[0].textContent).toContain("Redacted, username privacy mode is enabled")
  })
})
