// src/lib/__tests__/notifications.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import type { notificationTargets } from "@/lib/db/schema"
import type { SnapshotContext } from "@/lib/notifications/dispatch"
import type { NotificationTargetType } from "@/lib/notifications/types"

// Mock DB so dispatch.ts can be imported without a live database connection
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
}))

// Mock privacy module — isRedacted must work for rank_change redaction tests
vi.mock("@/lib/privacy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/privacy")>()
  return {
    ...actual,
  }
})

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeTarget(
  overrides: Partial<typeof notificationTargets.$inferSelect> = {}
): typeof notificationTargets.$inferSelect {
  return {
    id: 1,
    name: "Test Target",
    type: "discord",
    enabled: true,
    encryptedConfig: "encrypted",
    notifyRatioDrop: false,
    notifyHitAndRun: false,
    notifyTrackerDown: false,
    notifyBufferMilestone: false,
    notifyWarned: false,
    notifyRatioDanger: false,
    notifyZeroSeeding: false,
    notifyRankChange: false,
    notifyAnniversary: false,
    thresholds: null,
    includeTrackerName: true,
    scope: null,
    lastDeliveryStatus: null,
    lastDeliveryAt: null,
    lastDeliveryError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as typeof notificationTargets.$inferSelect
}

function makeContext(overrides: Partial<SnapshotContext> = {}): SnapshotContext {
  return {
    trackerId: 1,
    trackerName: "Test Tracker",
    storeUsernames: true,
    currentRatio: 1.5,
    previousRatio: 1.5,
    currentHnrs: 0,
    previousHnrs: 0,
    currentBufferBytes: 10000000000n,
    previousBufferBytes: 10000000000n,
    trackerDown: false,
    trackerError: null,
    currentWarned: false,
    previousWarned: false,
    currentSeedingCount: 10,
    currentGroup: "Power User",
    previousGroup: "Power User",
    trackerIsActive: true,
    trackerPausedAt: null,
    trackerJoinedAt: "2020-01-01",
    minimumRatio: 0.6,
    ...overrides,
  }
}

describe("notification types", () => {
  it("DISCORD_WEBHOOK_RE accepts valid Discord webhook URLs", async () => {
    const { DISCORD_WEBHOOK_RE } = await import("@/lib/notifications/types")
    expect(DISCORD_WEBHOOK_RE.test("https://discord.com/api/webhooks/123456789/abc-DEF_123")).toBe(
      true
    )
  })

  it("DISCORD_WEBHOOK_RE rejects non-Discord URLs", async () => {
    const { DISCORD_WEBHOOK_RE } = await import("@/lib/notifications/types")
    expect(DISCORD_WEBHOOK_RE.test("https://evil.com/api/webhooks/123/abc")).toBe(false)
    expect(DISCORD_WEBHOOK_RE.test("http://discord.com/api/webhooks/123/abc")).toBe(false)
    expect(DISCORD_WEBHOOK_RE.test("https://discord.com/api/webhooks//abc")).toBe(false)
  })
})

describe("validateNotificationConfig", () => {
  it("accepts valid Discord config", async () => {
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", {
      webhookUrl: "https://discord.com/api/webhooks/123456789/abc-DEF_123",
    })
    expect(result).toBeNull()
  })

  it("rejects Discord config with non-Discord URL", async () => {
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", { webhookUrl: "https://evil.com/hook" })
    expect(result).toMatch(/Discord webhook URL/)
  })

  it("rejects Discord config with HTTP URL", async () => {
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", {
      webhookUrl: "http://discord.com/api/webhooks/123/abc",
    })
    expect(result).toMatch(/Discord webhook URL/)
  })

  it("rejects Discord config with missing webhookUrl", async () => {
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", {})
    expect(result).toMatch(/webhookUrl/)
  })

  it("rejects unknown notification type", async () => {
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig(
      "carrier_pigeon" as unknown as NotificationTargetType,
      {}
    )
    expect(result).toMatch(/Unsupported/)
  })
})

describe("buildDiscordEmbed", () => {
  it("includes tracker name when includeTrackerName is true", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "ratio_drop",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: { previousRatio: 1.5, currentRatio: 1.2 },
    })
    expect(embed.description).toContain("MyTracker")
  })

  it("omits tracker name when includeTrackerName is false", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "ratio_drop",
      trackerName: "MyTracker",
      includeTrackerName: false,
      storeUsernames: true,
      data: { previousRatio: 1.5, currentRatio: 1.2 },
    })
    expect(embed.description).not.toContain("MyTracker")
  })

  it("never includes baseUrl in any embed", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "tracker_down",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: { error: "Connection refused" },
    })
    const json = JSON.stringify(embed)
    expect(json).not.toContain("https://")
    expect(json).not.toContain("http://")
  })

  it("omits tracker name AND any user-identifying data when both privacy flags are off", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "ratio_drop",
      trackerName: "SecretTracker",
      includeTrackerName: false,
      storeUsernames: false,
      data: { previousRatio: 1.5, currentRatio: 1.2 },
    })
    const json = JSON.stringify(embed)
    expect(json).not.toContain("SecretTracker")
    expect(embed.description).toContain("A tracker")
    expect(json).not.toContain("▓")
  })
})

// ─── Part 1: detectEvents — new event types ───────────────────────────────────

describe("detectEvents new event types", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("fires 'warned' when warned transitions false → true", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ previousWarned: false, currentWarned: true })
    const target = makeTarget({ notifyWarned: true })
    expect(detectEvents(ctx, target)).toContain("warned")
  })

  it("does not fire 'warned' when warned is sustained true", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ previousWarned: true, currentWarned: true })
    const target = makeTarget({ notifyWarned: true })
    expect(detectEvents(ctx, target)).not.toContain("warned")
  })

  it("fires 'ratio_danger' when ratio crosses below minimumRatio", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // previousRatio was above minimum, currentRatio is below — this is a transition
    const ctx = makeContext({ previousRatio: 0.8, currentRatio: 0.5, minimumRatio: 0.6 })
    const target = makeTarget({ notifyRatioDanger: true })
    expect(detectEvents(ctx, target)).toContain("ratio_danger")
  })

  it("does not fire 'ratio_danger' when already below minimum (sustained state)", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Both previous and current are below minimum — sustained, not a transition
    const ctx = makeContext({ previousRatio: 0.4, currentRatio: 0.3, minimumRatio: 0.6 })
    const target = makeTarget({ notifyRatioDanger: true })
    expect(detectEvents(ctx, target)).not.toContain("ratio_danger")
  })

  it("fires 'zero_seeding' when seedingCount is 0 and tracker is active", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ currentSeedingCount: 0, trackerIsActive: true })
    const target = makeTarget({ notifyZeroSeeding: true })
    expect(detectEvents(ctx, target)).toContain("zero_seeding")
  })

  it("does not fire 'zero_seeding' when tracker is inactive", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ currentSeedingCount: 0, trackerIsActive: false })
    const target = makeTarget({ notifyZeroSeeding: true })
    expect(detectEvents(ctx, target)).not.toContain("zero_seeding")
  })

  it("fires 'rank_change' when group changed", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ previousGroup: "Power User", currentGroup: "Elite" })
    const target = makeTarget({ notifyRankChange: true })
    expect(detectEvents(ctx, target)).toContain("rank_change")
  })

  it("does not fire 'rank_change' when group is unchanged", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ previousGroup: "Power User", currentGroup: "Power User" })
    const target = makeTarget({ notifyRankChange: true })
    expect(detectEvents(ctx, target)).not.toContain("rank_change")
  })

  it("does not fire 'rank_change' when group is redacted", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Redacted masks start with ▓ — checkRankChange returns null for these
    const ctx = makeContext({ previousGroup: "Power User", currentGroup: "▓5" })
    const target = makeTarget({ notifyRankChange: true })
    expect(detectEvents(ctx, target)).not.toContain("rank_change")
  })

  it("fires 'anniversary' when joinedAt is within milestone window", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-19T12:00:00"))
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Exactly 1 year after join date — within the ±3 day window
    const ctx = makeContext({ trackerJoinedAt: "2025-03-19" })
    const target = makeTarget({ notifyAnniversary: true })
    expect(detectEvents(ctx, target)).toContain("anniversary")
    vi.useRealTimers()
  })

  it("does not fire 'anniversary' when joinedAt is outside milestone window", async () => {
    vi.useFakeTimers()
    // 6 days after the 1-year anniversary — beyond the ±3 day window
    vi.setSystemTime(new Date("2026-03-25T12:00:00"))
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ trackerJoinedAt: "2025-03-19" })
    const target = makeTarget({ notifyAnniversary: true })
    expect(detectEvents(ctx, target)).not.toContain("anniversary")
    vi.useRealTimers()
  })
})

// ─── Part 2: notify* flag gating ─────────────────────────────────────────────

describe("detectEvents notify flag gating", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not emit 'warned' when notifyWarned is false", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Condition is met (transition false → true) but flag is disabled
    const ctx = makeContext({ previousWarned: false, currentWarned: true })
    const target = makeTarget({ notifyWarned: false })
    expect(detectEvents(ctx, target)).not.toContain("warned")
  })

  it("does not emit 'ratio_danger' when notifyRatioDanger is false", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Condition is met (crossing below minimum) but flag is disabled
    const ctx = makeContext({ previousRatio: 0.8, currentRatio: 0.5, minimumRatio: 0.6 })
    const target = makeTarget({ notifyRatioDanger: false })
    expect(detectEvents(ctx, target)).not.toContain("ratio_danger")
  })

  it("does not emit 'zero_seeding' when notifyZeroSeeding is false", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Condition is met (seedingCount=0 and active) but flag is disabled
    const ctx = makeContext({ currentSeedingCount: 0, trackerIsActive: true })
    const target = makeTarget({ notifyZeroSeeding: false })
    expect(detectEvents(ctx, target)).not.toContain("zero_seeding")
  })

  it("does not emit 'rank_change' when notifyRankChange is false", async () => {
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Condition is met (group changed) but flag is disabled
    const ctx = makeContext({ previousGroup: "Power User", currentGroup: "Elite" })
    const target = makeTarget({ notifyRankChange: false })
    expect(detectEvents(ctx, target)).not.toContain("rank_change")
  })

  it("does not emit 'anniversary' when notifyAnniversary is false", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-19T12:00:00"))
    const { detectEvents } = await import("@/lib/notifications/dispatch")
    // Condition is met (1-year anniversary) but flag is disabled
    const ctx = makeContext({ trackerJoinedAt: "2025-03-19" })
    const target = makeTarget({ notifyAnniversary: false })
    expect(detectEvents(ctx, target)).not.toContain("anniversary")
    vi.useRealTimers()
  })
})

// ─── Part 3: buildDiscordEmbed — new event types ──────────────────────────────

describe("buildDiscordEmbed new event types", () => {
  it("produces correct embed for warned event", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "warned",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: {},
    })
    expect(embed.title).toBe("Account Warning")
    expect(embed.color).toBe(0xf59e0b)
    expect(embed.description).toContain("MyTracker")
    expect(embed.description).toContain("warning")
  })

  it("produces correct embed for ratio_danger event", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "ratio_danger",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: { currentRatio: 0.5, minimumRatio: 0.6 },
    })
    expect(embed.title).toBe("Ratio Below Minimum")
    expect(embed.color).toBe(0xef4444)
    expect(embed.description).toContain("0.50")
    expect(embed.description).toContain("0.60")
    expect(embed.description).toContain("MyTracker")
  })

  it("produces correct embed for zero_seeding event", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "zero_seeding",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: {},
    })
    expect(embed.title).toBe("Zero Active Seeds")
    expect(embed.color).toBe(0xf59e0b)
    expect(embed.description).toContain("MyTracker")
    expect(embed.description).toContain("no active seeds")
  })

  it("produces correct embed for rank_change event", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "rank_change",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: { newGroup: "Elite", previousGroup: "Power User" },
    })
    expect(embed.title).toBe("Rank Change")
    expect(embed.color).toBe(0x00d4ff)
    expect(embed.description).toContain("Power User")
    expect(embed.description).toContain("Elite")
    expect(embed.description).toContain("MyTracker")
  })

  it("produces correct embed for anniversary event", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "anniversary",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: { label: "1 year anniversary" },
    })
    expect(embed.title).toBe("Membership Anniversary")
    expect(embed.color).toBe(0x00d4ff)
    expect(embed.description).toContain("MyTracker")
    expect(embed.description).toContain("1 year anniversary")
  })

  it("omits tracker name in rank_change embed when includeTrackerName is false", async () => {
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "rank_change",
      trackerName: "SecretTracker",
      includeTrackerName: false,
      storeUsernames: true,
      data: { newGroup: "Elite", previousGroup: "Power User" },
    })
    expect(embed.description).not.toContain("SecretTracker")
    expect(embed.description).toContain("A tracker")
  })
})
