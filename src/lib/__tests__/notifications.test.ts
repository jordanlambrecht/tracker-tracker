// src/lib/__tests__/notifications.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import type { NotificationTargetRow } from "@/lib/db/schema"
import type { NotificationTargetType, SnapshotContext } from "@/lib/notifications/types"

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

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeTarget(overrides: Partial<NotificationTargetRow> = {}): NotificationTargetRow {
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
    notifyBonusCap: false,
    notifyVipExpiring: false,
    notifyUnsatisfiedLimit: false,
    notifyActiveHnrs: false,
    notifyDownloadDisabled: false,
    thresholds: null,
    includeTrackerName: true,
    scope: null,
    lastDeliveryStatus: null,
    lastDeliveryAt: null,
    lastDeliveryError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
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
    platformContext: undefined,
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
    expect(result).toMatch(/not yet supported/)
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
      data: { label: "1-year anniversary" },
    })
    expect(embed.title).toBe("Membership Anniversary")

    expect(embed.description).toContain("MyTracker")
    expect(embed.description).toContain("1-year anniversary")
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

// ─── Part 4: buildEventData — pure switch statement coverage ─────────────────
//
// buildEventData is the bridge between SnapshotContext fields and the data
// object that payload.ts consumes. Each test targets a specific fallback branch
// that silently misbehaves if the source field is null or undefined.

describe("buildEventData", () => {
  it("tracker_down with null trackerError returns 'Unknown error' sentinel", async () => {
    // Catches: the ?? "Unknown error" fallback not working, which would send
    // Discord embeds containing "null" or "undefined" as the error message.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ trackerError: null })
    const data = buildEventData("tracker_down", ctx)
    expect(data.error).toBe("Unknown error")
  })

  it("tracker_down with a real error string passes it through unchanged", async () => {
    // Catches: the ?? operator accidentally overriding truthy values.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ trackerError: "Connection refused" })
    const data = buildEventData("tracker_down", ctx)
    expect(data.error).toBe("Connection refused")
  })

  it("buffer_milestone converts bigint to Number without precision loss for 10 GiB", async () => {
    // Catches: BigInt coercion bugs. Number(10737418240n) must equal the integer
    // 10737418240, not be truncated, NaN, or wrapped in an object.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ currentBufferBytes: 10737418240n })
    const data = buildEventData("buffer_milestone", ctx)
    expect(data.bufferBytes).toBe(10737418240)
    expect(typeof data.bufferBytes).toBe("number")
  })

  it("buffer_milestone with null currentBufferBytes returns 0", async () => {
    // Catches: Number(null) returning 0 correctly vs. a refactor that introduces
    // a null check path that forgets to coerce.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ currentBufferBytes: null })
    const data = buildEventData("buffer_milestone", ctx)
    expect(data.bufferBytes).toBe(0)
  })

  it("anniversary without a label returns the 'Anniversary' fallback string", async () => {
    // Catches: the ?? "Anniversary" fallback being removed or changed, which
    // would cause payload.ts to receive undefined and fall into a different branch.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext()
    const data = buildEventData("anniversary", ctx, undefined)
    expect(data.label).toBe("Anniversary")
  })

  it("anniversary with a label passes it through to the data object", async () => {
    // Catches: the label argument being ignored due to parameter order confusion.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext()
    const data = buildEventData("anniversary", ctx, null, "3 Year Anniversary")
    expect(data.label).toBe("3 Year Anniversary")
  })

  it("rank_change maps currentGroup to newGroup field name in the output", async () => {
    // Catches: field name typos (e.g. "currentGroup" vs "newGroup") that would
    // cause payload.ts to receive undefined and fall into the wrong description branch.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ currentGroup: "Elite", previousGroup: "Power User" })
    const data = buildEventData("rank_change", ctx)
    expect(data).toHaveProperty("newGroup", "Elite")
    expect(data).toHaveProperty("previousGroup", "Power User")
    // Confirm the field is NOT stored under the context's own name
    expect(data).not.toHaveProperty("currentGroup")
  })

  it("ratio_drop returns both ratio values under the correct field names", async () => {
    // Catches: field rename in SnapshotContext not propagating to buildEventData output.
    const { buildEventData } = await import("@/lib/notifications/dispatch")
    const ctx = makeContext({ previousRatio: 1.8, currentRatio: 1.2 })
    const data = buildEventData("ratio_drop", ctx)
    expect(data.previousRatio).toBe(1.8)
    expect(data.currentRatio).toBe(1.2)
  })
})

// ─── Part 5: validateNotificationConfig — uncovered edge cases ────────────────

describe("validateNotificationConfig edge cases", () => {
  it("rejects Discord config with empty string webhookUrl", async () => {
    // Catches: !url.trim() guard being removed, which would let empty strings
    // pass through to the regex test (which would also fail, but for the wrong reason).
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", { webhookUrl: "" })
    expect(result).toMatch(/webhookUrl/)
  })

  it("rejects Discord config with whitespace-only webhookUrl", async () => {
    // Catches: validation only checking typeof but not trimming before the check.
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", { webhookUrl: "   " })
    expect(result).toMatch(/webhookUrl/)
  })

  it("rejects Discord config where webhookUrl is a number, not a string", async () => {
    // Catches: the typeof url !== "string" guard. A number would pass trim()
    // if the guard were missing and coercion happened silently.
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("discord", { webhookUrl: 12345 as unknown as string })
    expect(result).toMatch(/webhookUrl/)
  })

  it("gotify returns a 'not yet supported' message (not null, not 'Unsupported')", async () => {
    // Catches: a dev adding "gotify" to VALID_NOTIFICATION_TYPES but forgetting
    // the switch case, which would fall through to the default "Unsupported" branch
    // instead of the intended "not yet supported" message.
    const { validateNotificationConfig } = await import("@/lib/notifications/validate")
    const result = validateNotificationConfig("gotify", {})
    expect(result).not.toBeNull()
    expect(result).toMatch(/not yet supported/)
  })
})

// ─── Part 6: buildDescription fallback branches in payload.ts ─────────────────
//
// These test branches in buildDescription that only fire when the data object
// is missing expected fields. The only way to reach them in production is when
// buildEventData has a bug — so these tests pin the fallback contract.

describe("buildDescription fallback branches", () => {
  it("rank_change with only newGroup (no previousGroup) uses the rank-only path", async () => {
    // Catches: the `if (newGroup)` branch being removed or merged with the
    // two-group branch, leaving no single-group fallback.
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "rank_change",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: { newGroup: "Elite", previousGroup: undefined },
    })
    expect(embed.description).toContain("Elite")
    expect(embed.description).not.toContain("undefined")
    expect(embed.description).not.toContain("from")
    // The generic fallback must NOT fire when newGroup is present
    expect(embed.description).not.toBe("MyTracker rank has changed")
  })

  it("rank_change with neither group falls back to the generic description", async () => {
    // Catches: the default branch at the end of the rank_change case being
    // accidentally removed, which would return "undefined" in the description.
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "rank_change",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: {},
    })
    expect(embed.description).toContain("rank has changed")
    expect(embed.description).not.toContain("undefined")
    expect(embed.description).not.toContain("null")
  })

  it("buffer_milestone with missing bufferBytes data uses 'unknown' label", async () => {
    // Catches: the `bytes ? formatBytesNum(bytes) : "unknown"` guard. If bytes
    // is 0 or absent, this must not produce "undefined" or "NaN" in the embed.
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "buffer_milestone",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: {},
    })
    expect(embed.description).toContain("unknown")
    expect(embed.description).not.toContain("undefined")
    expect(embed.description).not.toContain("NaN")
  })

  it("anniversary with undefined label falls back to membership anniversary text", async () => {
    // Catches: the `label ? ... : ...` ternary in buildDescription. When
    // buildEventData passes "Anniversary" (the fallback string from dispatch.ts),
    // this branch should NOT fire — but it must work correctly when data arrives
    // without a label key at all.
    const { buildDiscordEmbed } = await import("@/lib/notifications/payload")
    const embed = buildDiscordEmbed({
      eventType: "anniversary",
      trackerName: "MyTracker",
      includeTrackerName: true,
      storeUsernames: true,
      data: {},
    })
    expect(embed.description).toContain("membership anniversary")
    expect(embed.description).not.toContain("undefined")
  })
})
