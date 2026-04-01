// src/lib/__tests__/slot-resolve.test.tsx

import { describe, expect, it } from "vitest"
import { resolveSlots } from "@/components/tracker-detail/resolve-slots"
import type {
  GazellePlatformMeta,
  GGnPlatformMeta,
  NebulancePlatformMeta,
} from "@/lib/adapters/types"
import type { SlotContext } from "@/lib/slot-types"
import type { Snapshot, TrackerSummary } from "@/types/api"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTracker(overrides: Partial<TrackerSummary> = {}): TrackerSummary {
  return {
    id: 1,
    name: "Test Tracker",
    baseUrl: "https://tracker.example.com",
    platformType: "ggn",
    isActive: true,
    lastPolledAt: null,
    lastError: null,
    consecutiveFailures: 0,
    pausedAt: null,
    userPausedAt: null,
    color: "#00d4ff",
    qbtTag: null,
    mouseholeUrl: null,
    hideUnreadBadges: false,
    useProxy: false,
    countCrossSeedUnsatisfied: false,
    isFavorite: false,
    sortOrder: null,
    joinedAt: null,
    lastAccessAt: null,
    remoteUserId: null,
    platformMeta: null,
    createdAt: "2024-01-01T00:00:00Z",
    latestStats: null,
    ...overrides,
  }
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    polledAt: "2024-01-01T00:00:00Z",
    uploadedBytes: "10737418240",
    downloadedBytes: "5368709120",
    ratio: 2.0,
    bufferBytes: "0",
    seedbonus: null,
    seedingCount: 5,
    leechingCount: 0,
    hitAndRuns: 0,
    requiredRatio: null,
    warned: null,
    freeleechTokens: null,
    shareScore: null,
    username: "testuser",
    group: null,
    ...overrides,
  }
}

const BASE_ACCENT = "#00d4ff"

// ---------------------------------------------------------------------------
// Helper — extract slot ids from the map for a given category
// ---------------------------------------------------------------------------

function slotIds(ctx: SlotContext, category: "badge" | "stat-card" | "progress"): string[] {
  const map = resolveSlots(ctx)
  return (map.get(category) ?? []).map((s) => s.id)
}

// ---------------------------------------------------------------------------
// Test 1: GGn context
// ---------------------------------------------------------------------------

describe("GGn context", () => {
  const ggnMeta: GGnPlatformMeta = {
    hourlyGold: 5,
    donor: true,
    parked: true,
    onIRC: true,
    invites: 3,
    achievements: {
      userLevel: "Adept",
      nextLevel: "Expert",
      totalPoints: 1000,
      pointsToNextLvl: 200,
    },
    buffs: { upload: 2, freeleech: 1.5 },
  }

  const snap = makeSnapshot({ seedbonus: 12345, shareScore: 9.5, warned: true })

  const ctx: SlotContext = {
    tracker: makeTracker({ platformType: "ggn" }),
    latestSnapshot: snap,
    meta: ggnMeta,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("resolves gold stat card", () => {
    expect(slotIds(ctx, "stat-card")).toContain("gold")
  })

  it("resolves ggn-share-score-card", () => {
    expect(slotIds(ctx, "stat-card")).toContain("ggn-share-score-card")
  })

  it("does NOT resolve seedbonus (hourlyGold present)", () => {
    expect(slotIds(ctx, "stat-card")).not.toContain("seedbonus")
  })

  it("resolves achievement-progress", () => {
    expect(slotIds(ctx, "progress")).toContain("ggn-achievement-progress")
  })

  it("resolves share-score-progress", () => {
    expect(slotIds(ctx, "progress")).toContain("ggn-share-score-progress")
  })

  it("resolves ggn-buffs", () => {
    expect(slotIds(ctx, "progress")).toContain("ggn-buffs")
  })

  it("resolves warned badge", () => {
    expect(slotIds(ctx, "badge")).toContain("warned")
  })

  it("resolves donor badge", () => {
    expect(slotIds(ctx, "badge")).toContain("donor")
  })

  it("resolves ggn-parked badge", () => {
    expect(slotIds(ctx, "badge")).toContain("ggn-parked")
  })

  it("resolves ggn-irc badge", () => {
    expect(slotIds(ctx, "badge")).toContain("ggn-irc")
  })

  it("resolves ggn-invites badge", () => {
    expect(slotIds(ctx, "badge")).toContain("ggn-invites")
  })

  it("gold card rows include balance and per hour", () => {
    const map = resolveSlots(ctx)
    const goldCard = map.get("stat-card")?.find((s) => s.id === "gold")
    const rows = goldCard?.props.rows as { label: string; value: string | number }[]
    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe("Balance")
    expect(rows[0].value).toBe("12,345")
    expect(rows[1].label).toBe("Per Hour")
  })

  it("ggn-irc badge children is a react element", () => {
    const map = resolveSlots(ctx)
    const ircBadge = map.get("badge")?.find((s) => s.id === "ggn-irc")
    expect(ircBadge?.props.children).toBeTruthy()
    expect(typeof ircBadge?.props.children).toBe("object")
  })

  it("ggn-invites badge label shows count", () => {
    const map = resolveSlots(ctx)
    const invitesBadge = map.get("badge")?.find((s) => s.id === "ggn-invites")
    expect(invitesBadge?.props.label).toBe("3 Invites")
  })

  it("achievement progress props include ggMeta and accentColor", () => {
    const map = resolveSlots(ctx)
    const achievSlot = map.get("progress")?.find((s) => s.id === "ggn-achievement-progress")
    expect(achievSlot?.props.ggMeta).toBe(ggnMeta)
    expect(achievSlot?.props.accentColor).toBe(BASE_ACCENT)
  })

  it("share-score-progress props include latestSnapshot", () => {
    const map = resolveSlots(ctx)
    const ssSlot = map.get("progress")?.find((s) => s.id === "ggn-share-score-progress")
    expect(ssSlot?.props.latestSnapshot).toBe(snap)
    expect(ssSlot?.props.accentColor).toBe(BASE_ACCENT)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Gazelle context
// ---------------------------------------------------------------------------

describe("Gazelle context", () => {
  const gazMeta: GazellePlatformMeta = {
    donor: true,
    paranoiaText: "High",
    giftTokens: 10,
    meritTokens: 5,
    notifications: { messages: 3, notifications: 1, newAnnouncement: false, newBlog: false },
    community: {
      posts: 50,
      torrentComments: 10,
      artistComments: 0,
      collageComments: 0,
      requestComments: 0,
      collagesStarted: 2,
      collagesContrib: 8,
      requestsFilled: 4,
      requestsVoted: 20,
      perfectFlacs: 15,
      uploaded: 30,
      groups: 12,
      snatched: 200,
      invited: 2,
      bountyEarned: null,
      bountySpent: 209715200,
    },
  }

  const snap = makeSnapshot({ warned: true })

  const ctx: SlotContext = {
    tracker: makeTracker({ platformType: "gazelle" }),
    latestSnapshot: snap,
    meta: gazMeta,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("resolves gazelle-tokens (merged FL + merit)", () => {
    expect(slotIds(ctx, "stat-card")).toContain("gazelle-tokens")
  })

  it("resolves perfect-flacs", () => {
    expect(slotIds(ctx, "stat-card")).toContain("perfect-flacs")
  })

  it("resolves snatched-gazelle", () => {
    expect(slotIds(ctx, "stat-card")).toContain("snatched-gazelle")
  })

  it("resolves torrents-uploaded", () => {
    expect(slotIds(ctx, "stat-card")).toContain("torrents-uploaded")
  })

  it("resolves requests-filled", () => {
    expect(slotIds(ctx, "stat-card")).toContain("requests-filled")
  })

  it("resolves groups-contributed", () => {
    expect(slotIds(ctx, "stat-card")).toContain("groups-contributed")
  })

  it("resolves invited", () => {
    expect(slotIds(ctx, "stat-card")).toContain("invited")
  })

  it("resolves warned badge", () => {
    expect(slotIds(ctx, "badge")).toContain("warned")
  })

  it("resolves donor badge", () => {
    expect(slotIds(ctx, "badge")).toContain("donor")
  })

  it("resolves gazelle-paranoia badge", () => {
    expect(slotIds(ctx, "badge")).toContain("gazelle-paranoia")
  })

  it("resolves gazelle-unread badge", () => {
    expect(slotIds(ctx, "badge")).toContain("gazelle-unread")
  })

  it("does NOT resolve ggn-specific badges", () => {
    const badges = slotIds(ctx, "badge")
    expect(badges).not.toContain("ggn-parked")
    expect(badges).not.toContain("ggn-irc")
    expect(badges).not.toContain("ggn-invites")
  })

  it("does NOT resolve ggn-specific progress", () => {
    const progress = slotIds(ctx, "progress")
    expect(progress).not.toContain("ggn-achievement-progress")
    expect(progress).not.toContain("ggn-share-score-progress")
    expect(progress).not.toContain("ggn-buffs")
  })

  it("paranoia badge label includes paranoiaText", () => {
    const map = resolveSlots(ctx)
    const badge = map.get("badge")?.find((s) => s.id === "gazelle-paranoia")
    expect(badge?.props.label).toBe("Paranoia: High")
  })

  it("unread badge label shows message count", () => {
    const map = resolveSlots(ctx)
    const badge = map.get("badge")?.find((s) => s.id === "gazelle-unread")
    expect(badge?.props.label).toBe("3 Unread")
  })
})

// ---------------------------------------------------------------------------
// Test 3: Minimal context — no meta, snapshot with seedbonus
// ---------------------------------------------------------------------------

describe("minimal context (no meta, seedbonus present)", () => {
  const snap = makeSnapshot({ seedbonus: 999 })

  const ctx: SlotContext = {
    tracker: makeTracker({ platformType: "unit3d" }),
    latestSnapshot: snap,
    meta: null,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("resolves seedbonus", () => {
    expect(slotIds(ctx, "stat-card")).toContain("seedbonus")
  })

  it("does not resolve ggn or gazelle specific cards", () => {
    const cards = slotIds(ctx, "stat-card")
    expect(cards).not.toContain("gold")
    expect(cards).not.toContain("gazelle-tokens")
    expect(cards).not.toContain("snatched-gazelle")
    expect(cards).not.toContain("snatched-nebulance")
  })

  it("produces no badge slots when no warned/donor/etc", () => {
    const badges = slotIds(ctx, "badge")
    expect(badges).not.toContain("warned")
    expect(badges).not.toContain("donor")
  })

  it("produces no progress slots", () => {
    const progress = resolveSlots(ctx).get("progress")
    expect(progress).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Test 4: Null latestSnapshot
// ---------------------------------------------------------------------------

describe("null latestSnapshot", () => {
  const ctx: SlotContext = {
    tracker: makeTracker(),
    latestSnapshot: null,
    meta: null,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("does not resolve seedbonus when snapshot is null", () => {
    expect(slotIds(ctx, "stat-card")).not.toContain("seedbonus")
  })

  it("does not resolve warned badge when snapshot is null", () => {
    expect(slotIds(ctx, "badge")).not.toContain("warned")
  })

  it("does not resolve ggn-share-score-card when snapshot is null", () => {
    const ggnMeta: GGnPlatformMeta = { hourlyGold: 5 }
    const ctxWithMeta: SlotContext = { ...ctx, meta: ggnMeta }
    expect(slotIds(ctxWithMeta, "stat-card")).not.toContain("ggn-share-score-card")
  })
})

// ---------------------------------------------------------------------------
// Test 5: Priority ordering within each category
// ---------------------------------------------------------------------------

describe("priority ordering", () => {
  const ggnMeta: GGnPlatformMeta = {
    hourlyGold: 5,
    invites: 2,
    parked: true,
    onIRC: true,
    achievements: {
      userLevel: "L1",
      nextLevel: "L2",
      totalPoints: 100,
      pointsToNextLvl: 50,
    },
    buffs: { upload: 2 },
  }

  const snap = makeSnapshot({ seedbonus: 100, shareScore: 5.0, warned: true })

  const ctx: SlotContext = {
    tracker: makeTracker(),
    latestSnapshot: snap,
    meta: ggnMeta,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("badges are sorted by priority ascending", () => {
    const map = resolveSlots(ctx)
    const badges = map.get("badge") ?? []
    for (let i = 1; i < badges.length; i++) {
      expect(badges[i].priority).toBeGreaterThanOrEqual(badges[i - 1].priority)
    }
  })

  it("stat-cards are sorted by priority ascending", () => {
    const map = resolveSlots(ctx)
    const cards = map.get("stat-card") ?? []
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i].priority).toBeGreaterThanOrEqual(cards[i - 1].priority)
    }
  })

  it("progress slots are sorted by priority ascending", () => {
    const map = resolveSlots(ctx)
    const progress = map.get("progress") ?? []
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i].priority).toBeGreaterThanOrEqual(progress[i - 1].priority)
    }
  })
})

// ---------------------------------------------------------------------------
// Test 6: Mutual exclusion — Nebulance context
// ---------------------------------------------------------------------------

describe("mutual exclusion: Nebulance snatched-nebulance vs seedbonus", () => {
  const nebMeta: NebulancePlatformMeta = {
    snatched: 42,
    grabbed: 10,
  }

  const snap = makeSnapshot({ seedbonus: 500 })

  const ctx: SlotContext = {
    tracker: makeTracker({ platformType: "nebulance" }),
    latestSnapshot: snap,
    meta: nebMeta,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("resolves snatched-nebulance", () => {
    expect(slotIds(ctx, "stat-card")).toContain("snatched-nebulance")
  })

  it("does NOT resolve seedbonus (snatched in meta blocks it)", () => {
    expect(slotIds(ctx, "stat-card")).not.toContain("seedbonus")
  })

  it("does NOT resolve gold (no hourlyGold)", () => {
    expect(slotIds(ctx, "stat-card")).not.toContain("gold")
  })

  it("snatched-nebulance value equals meta.snatched", () => {
    const map = resolveSlots(ctx)
    const card = map.get("stat-card")?.find((s) => s.id === "snatched-nebulance")
    expect(card?.props.value).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// Test 7: Mutual exclusion — GGn context (hourlyGold blocks seedbonus)
// ---------------------------------------------------------------------------

describe("mutual exclusion: GGn hourlyGold blocks seedbonus", () => {
  const ggnMeta: GGnPlatformMeta = {
    hourlyGold: 10,
  }

  const snap = makeSnapshot({ seedbonus: 777 })

  const ctx: SlotContext = {
    tracker: makeTracker({ platformType: "ggn" }),
    latestSnapshot: snap,
    meta: ggnMeta,
    registry: undefined,
    accentColor: BASE_ACCENT,
  }

  it("resolves gold", () => {
    expect(slotIds(ctx, "stat-card")).toContain("gold")
  })

  it("does NOT resolve seedbonus", () => {
    expect(slotIds(ctx, "stat-card")).not.toContain("seedbonus")
  })

  it("does NOT resolve snatched-nebulance", () => {
    expect(slotIds(ctx, "stat-card")).not.toContain("snatched-nebulance")
  })
})

// ---------------------------------------------------------------------------
// Test 8: Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("gazelle-paranoia does not fire when paranoiaText is 'Off'", () => {
    const meta: GazellePlatformMeta = { paranoiaText: "Off" }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "badge")).not.toContain("gazelle-paranoia")
  })

  it("gazelle-unread does not fire when messages is 0", () => {
    const meta: GazellePlatformMeta = {
      notifications: { messages: 0, notifications: 0, newAnnouncement: false, newBlog: false },
    }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "badge")).not.toContain("gazelle-unread")
  })

  it("ggn-invites does not fire when invites is 0", () => {
    const meta: GGnPlatformMeta = { invites: 0 }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "badge")).not.toContain("ggn-invites")
  })

  it("disabled badge fires when enabled is false", () => {
    const meta: GazellePlatformMeta = { enabled: false }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "badge")).toContain("disabled")
  })

  it("disabled badge does NOT fire when enabled is true", () => {
    const meta: GazellePlatformMeta = { enabled: true }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "badge")).not.toContain("disabled")
  })

  it("perfect-flacs does not fire when count is 0", () => {
    const meta: GazellePlatformMeta = {
      community: {
        posts: 0,
        torrentComments: 0,
        artistComments: 0,
        collageComments: 0,
        requestComments: 0,
        collagesStarted: 0,
        collagesContrib: 0,
        requestsFilled: 0,
        requestsVoted: 0,
        perfectFlacs: 0,
        uploaded: 0,
        groups: 0,
        snatched: 5,
        invited: 0,
        bountyEarned: null,
        bountySpent: null,
      },
    }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "stat-card")).not.toContain("perfect-flacs")
  })

  it("ggn-buffs does not fire when buffs object is empty", () => {
    const meta: GGnPlatformMeta = { hourlyGold: 5, buffs: {} }
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: makeSnapshot({ seedbonus: 100 }),
        meta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    expect(slotIds(ctx, "progress")).not.toContain("ggn-buffs")
  })

  it("resolveSlots returns empty map when nothing resolves", () => {
    const ctx: SlotContext = {
      tracker: makeTracker(),
      latestSnapshot: null,
        meta: null,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }
    const map = resolveSlots(ctx)
    expect(map.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 9: login-deadline slot
// ---------------------------------------------------------------------------

describe("login-deadline slot", () => {
  it("fills when lastAccessAt and loginIntervalDays are present", () => {
    const ctx: SlotContext = {
      tracker: makeTracker({ lastAccessAt: "2026-01-01T00:00:00Z" }),
      latestSnapshot: null,
        meta: null,
      registry: {
        slug: "test",
        name: "Test",
        url: "https://tracker.example.com",
        description: "",
        platform: "unit3d",
        apiPath: "",
        specialty: "",
        contentCategories: [],
        userClasses: [],
        releaseGroups: [],
        notableMembers: [],
        color: "#00d4ff",
        rules: {
          minimumRatio: 1.0,
          seedTimeHours: 72,
          loginIntervalDays: 90,
        },
      },
      accentColor: BASE_ACCENT,
    }

    const map = resolveSlots(ctx)
    const ids = (map.get("stat-card") ?? []).map((s) => s.id)
    expect(ids).toContain("login-deadline")

    const slot = map.get("stat-card")?.find((s) => s.id === "login-deadline")
    expect(slot?.props.lastAccessAt).toBe("2026-01-01T00:00:00Z")
    expect(slot?.props.loginIntervalDays).toBe(90)
    expect(slot?.props.accentColor).toBe(BASE_ACCENT)
  })

  it("returns null when lastAccessAt is missing", () => {
    const ctx: SlotContext = {
      tracker: makeTracker({ lastAccessAt: null }),
      latestSnapshot: null,
        meta: null,
      registry: {
        slug: "test",
        name: "Test",
        url: "https://tracker.example.com",
        description: "",
        platform: "unit3d",
        apiPath: "",
        specialty: "",
        contentCategories: [],
        userClasses: [],
        releaseGroups: [],
        notableMembers: [],
        color: "#00d4ff",
        rules: {
          minimumRatio: 1.0,
          seedTimeHours: 72,
          loginIntervalDays: 90,
        },
      },
      accentColor: BASE_ACCENT,
    }

    const ids = slotIds(ctx, "stat-card")
    expect(ids).not.toContain("login-deadline")
  })

  it("returns null when loginIntervalDays is 0", () => {
    const ctx: SlotContext = {
      tracker: makeTracker({ lastAccessAt: "2026-01-01T00:00:00Z" }),
      latestSnapshot: null,
        meta: null,
      registry: {
        slug: "test",
        name: "Test",
        url: "https://tracker.example.com",
        description: "",
        platform: "unit3d",
        apiPath: "",
        specialty: "",
        contentCategories: [],
        userClasses: [],
        releaseGroups: [],
        notableMembers: [],
        color: "#00d4ff",
        rules: {
          minimumRatio: 1.0,
          seedTimeHours: 72,
          loginIntervalDays: 0,
        },
      },
      accentColor: BASE_ACCENT,
    }

    const ids = slotIds(ctx, "stat-card")
    expect(ids).not.toContain("login-deadline")
  })

  it("returns null when loginIntervalDays is undefined (no rules)", () => {
    const ctx: SlotContext = {
      tracker: makeTracker({ lastAccessAt: "2026-01-01T00:00:00Z" }),
      latestSnapshot: null,
        meta: null,
      registry: {
        slug: "test",
        name: "Test",
        url: "https://tracker.example.com",
        description: "",
        platform: "unit3d",
        apiPath: "",
        specialty: "",
        contentCategories: [],
        userClasses: [],
        releaseGroups: [],
        notableMembers: [],
        color: "#00d4ff",
      },
      accentColor: BASE_ACCENT,
    }

    const ids = slotIds(ctx, "stat-card")
    expect(ids).not.toContain("login-deadline")
  })

  it("returns null when registry is undefined", () => {
    const ctx: SlotContext = {
      tracker: makeTracker({ lastAccessAt: "2026-01-01T00:00:00Z" }),
      latestSnapshot: null,
        meta: null,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }

    const ids = slotIds(ctx, "stat-card")
    expect(ids).not.toContain("login-deadline")
  })
})

// ---------------------------------------------------------------------------
// Security: resolved slot props never contain secrets
// ---------------------------------------------------------------------------

describe("security: slot resolution does not expose secrets", () => {
  it("no resolved slot props contain encrypted fields or credentials", () => {
    const ggnMeta: GGnPlatformMeta = {
      hourlyGold: 5,
      donor: true,
      parked: true,
      onIRC: true,
      invites: 3,
      achievements: {
        userLevel: "Adept",
        nextLevel: "Expert",
        totalPoints: 1000,
        pointsToNextLvl: 200,
      },
      buffs: { upload: 2, freeleech: 1.5 },
      snatched: 500,
    }

    const snap = makeSnapshot({ seedbonus: 12345, shareScore: 9.5, warned: true })

    const ctx: SlotContext = {
      tracker: makeTracker({
        platformType: "ggn",
        lastAccessAt: "2026-01-01T00:00:00Z",
      }),
      latestSnapshot: snap,
        meta: ggnMeta,
      registry: {
        slug: "test",
        name: "Test",
        url: "https://tracker.example.com",
        description: "",
        platform: "ggn",
        apiPath: "",
        specialty: "",
        contentCategories: [],
        userClasses: [],
        releaseGroups: [],
        notableMembers: [],
        color: "#00d4ff",
        rules: { loginIntervalDays: 90, minimumRatio: 0, seedTimeHours: 0 },
      },
      accentColor: BASE_ACCENT,
    }

    const map = resolveSlots(ctx)

    // Flatten ALL resolved slot props and verify no secrets leaked
    const forbidden = [
      "encryptedApiToken",
      "passwordHash",
      "encryptionSalt",
      "encryptedPassword",
      "encryptedUsername",
      "totpSecret",
      "totpBackupCodes",
    ]
    for (const [, slots] of map) {
      for (const slot of slots) {
        const propsJson = JSON.stringify(slot.props)
        for (const field of forbidden) {
          expect(propsJson).not.toContain(field)
        }
      }
    }
  })

  it("TrackerSummary fixture does not include encryptedApiToken", () => {
    // If someone adds encryptedApiToken to makeTracker/TrackerSummary, this breaks
    const tracker = makeTracker()
    expect("encryptedApiToken" in tracker).toBe(false)
  })

  it("JSON.parse of adversarial __proto__ meta does not pollute slot resolution", () => {
    // JSON.parse creates literal __proto__ own-property, not prototype chain pollution
    const poisonedMeta = JSON.parse('{"__proto__": {"hourlyGold": 999}, "donor": true}')

    const ctx: SlotContext = {
      tracker: makeTracker({ platformType: "unit3d" }),
      latestSnapshot: makeSnapshot({ seedbonus: 100 }),
        meta: poisonedMeta,
      registry: undefined,
      accentColor: BASE_ACCENT,
    }

    // "hourlyGold" in meta should NOT match via __proto__ for real JSON.parse output
    // The gold slot resolves based on "hourlyGold" being a direct property of meta
    // JSON.parse puts __proto__ as a literal own-key, not on the chain
    const cards = slotIds(ctx, "stat-card")
    // seedbonus should still resolve since there's no direct "hourlyGold" key
    expect(cards).toContain("seedbonus")
    // Should not throw
    expect(() => resolveSlots(ctx)).not.toThrow()
  })
})
