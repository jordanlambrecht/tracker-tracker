// src/lib/__tests__/server-data.test.ts
//
// Tests for server-side data fetcher security invariants:
// - Settings column projection excludes encrypted fields
// - serializeSettingsResponse coerces password presence to boolean
// - serializeTrackerResponse (via tracker-serializer) excludes encryptedApiToken

import { describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that touches the DB
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    execute: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {
    storeUsernames: "storeUsernames",
    username: "username",
    sessionTimeoutMinutes: "sessionTimeoutMinutes",
    lockoutEnabled: "lockoutEnabled",
    lockoutThreshold: "lockoutThreshold",
    lockoutDurationMinutes: "lockoutDurationMinutes",
    snapshotRetentionDays: "snapshotRetentionDays",
    trackerPollIntervalMinutes: "trackerPollIntervalMinutes",
    proxyEnabled: "proxyEnabled",
    proxyType: "proxyType",
    proxyHost: "proxyHost",
    proxyPort: "proxyPort",
    proxyUsername: "proxyUsername",
    encryptedProxyPassword: "encryptedProxyPassword",
    qbitmanageEnabled: "qbitmanageEnabled",
    qbitmanageTags: "qbitmanageTags",
    backupScheduleEnabled: "backupScheduleEnabled",
    backupScheduleFrequency: "backupScheduleFrequency",
    backupRetentionCount: "backupRetentionCount",
    backupEncryptionEnabled: "backupEncryptionEnabled",
    encryptedBackupPassword: "encryptedBackupPassword",
    backupStoragePath: "backupStoragePath",
    // These are the sensitive columns that must NOT appear in settingsColumns:
    passwordHash: "passwordHash",
    encryptionSalt: "encryptionSalt",
    totpSecret: "totpSecret",
    totpBackupCodes: "totpBackupCodes",
    failedLoginAttempts: "failedLoginAttempts",
    lockedUntil: "lockedUntil",
    encryptedSchedulerKey: "encryptedSchedulerKey",
  },
  trackers: {
    id: "id",
    name: "name",
    baseUrl: "baseUrl",
    apiPath: "apiPath",
    platformType: "platformType",
    encryptedApiToken: "encryptedApiToken",
    isActive: "isActive",
    lastPolledAt: "lastPolledAt",
    lastError: "lastError",
    consecutiveFailures: "consecutiveFailures",
    pausedAt: "pausedAt",
    userPausedAt: "userPausedAt",
    color: "color",
    qbtTag: "qbtTag",
    remoteUserId: "remoteUserId",
    platformMeta: "platformMeta",
    avatarData: "avatarData",
    avatarCachedAt: "avatarCachedAt",
    avatarRemoteUrl: "avatarRemoteUrl",
    useProxy: "useProxy",
    countCrossSeedUnsatisfied: "countCrossSeedUnsatisfied",
    isFavorite: "isFavorite",
    sortOrder: "sortOrder",
    joinedAt: "joinedAt",
    lastAccessAt: "lastAccessAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  trackerSnapshots: {
    trackerId: "trackerId",
    polledAt: "polledAt",
  },
}))

vi.mock("@/lib/privacy-db", () => ({
  createPrivacyMaskSync: vi.fn().mockReturnValue((v: string | null | undefined) => v ?? null),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { SettingsRow } from "@/lib/server-data"
import { serializeSettingsResponse, settingsColumns, trackerColumns } from "@/lib/server-data"

// ---------------------------------------------------------------------------
// 1. Settings column projection: encrypted fields structurally excluded
// ---------------------------------------------------------------------------

describe("settingsColumns security invariant", () => {
  const columnKeys = Object.keys(settingsColumns)

  it("does NOT include passwordHash", () => {
    expect(columnKeys).not.toContain("passwordHash")
  })

  it("does NOT include encryptionSalt", () => {
    expect(columnKeys).not.toContain("encryptionSalt")
  })

  it("does NOT include totpSecret", () => {
    expect(columnKeys).not.toContain("totpSecret")
  })

  it("does NOT include totpBackupCodes", () => {
    expect(columnKeys).not.toContain("totpBackupCodes")
  })

  it("does NOT include failedLoginAttempts", () => {
    expect(columnKeys).not.toContain("failedLoginAttempts")
  })

  it("does NOT include lockedUntil", () => {
    expect(columnKeys).not.toContain("lockedUntil")
  })

  it("does NOT include encryptedProxyPassword as a direct key", () => {
    // hasProxyPassword references the encrypted column for boolean coercion,
    // but the key name "encryptedProxyPassword" must never appear
    expect(columnKeys).not.toContain("encryptedProxyPassword")
  })

  it("does NOT include encryptedBackupPassword as a direct key", () => {
    expect(columnKeys).not.toContain("encryptedBackupPassword")
  })

  it("does NOT include encryptedSchedulerKey", () => {
    expect(columnKeys).not.toContain("encryptedSchedulerKey")
  })

  it("DOES include hasProxyPassword (boolean alias for encrypted column)", () => {
    expect(columnKeys).toContain("hasProxyPassword")
  })

  it("DOES include hasBackupPassword (boolean alias for encrypted column)", () => {
    expect(columnKeys).toContain("hasBackupPassword")
  })

  it("includes expected safe columns", () => {
    const expectedSafeKeys = [
      "storeUsernames",
      "username",
      "sessionTimeoutMinutes",
      "lockoutEnabled",
      "lockoutThreshold",
      "lockoutDurationMinutes",
      "snapshotRetentionDays",
      "trackerPollIntervalMinutes",
      "proxyEnabled",
      "proxyType",
      "proxyHost",
      "proxyPort",
      "proxyUsername",
      "qbitmanageEnabled",
      "qbitmanageTags",
      "backupScheduleEnabled",
      "backupScheduleFrequency",
      "backupRetentionCount",
      "backupEncryptionEnabled",
      "backupStoragePath",
    ]
    for (const key of expectedSafeKeys) {
      expect(columnKeys).toContain(key)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. serializeSettingsResponse: boolean coercion for password presence
// ---------------------------------------------------------------------------

describe("serializeSettingsResponse", () => {
  const baseRow: SettingsRow = {
    storeUsernames: true,
    username: "admin",
    sessionTimeoutMinutes: 60,
    lockoutEnabled: true,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    snapshotRetentionDays: 30,
    trackerPollIntervalMinutes: 60,
    proxyEnabled: false,
    proxyType: "socks5",
    proxyHost: null,
    proxyPort: 1080,
    proxyUsername: null,
    hasProxyPassword: null,
    qbitmanageEnabled: false,
    qbitmanageTags: null,
    backupScheduleEnabled: false,
    backupScheduleFrequency: "daily",
    backupRetentionCount: 14,
    backupEncryptionEnabled: false,
    hasBackupPassword: null,
    backupStoragePath: null,
  }

  it("converts null hasProxyPassword to false", () => {
    const result = serializeSettingsResponse({ ...baseRow, hasProxyPassword: null })
    expect(result.hasProxyPassword).toBe(false)
  })

  it("converts truthy hasProxyPassword to true", () => {
    const result = serializeSettingsResponse({
      ...baseRow,
      hasProxyPassword: "encrypted-ciphertext-value",
    })
    expect(result.hasProxyPassword).toBe(true)
  })

  it("converts null hasBackupPassword to false", () => {
    const result = serializeSettingsResponse({ ...baseRow, hasBackupPassword: null })
    expect(result.hasBackupPassword).toBe(false)
  })

  it("converts truthy hasBackupPassword to true", () => {
    const result = serializeSettingsResponse({
      ...baseRow,
      hasBackupPassword: "encrypted-backup-pw",
    })
    expect(result.hasBackupPassword).toBe(true)
  })

  it("does NOT include any encrypted field values in the output", () => {
    const result = serializeSettingsResponse({
      ...baseRow,
      hasProxyPassword: "SUPER_SECRET_PROXY_PW",
      hasBackupPassword: "SUPER_SECRET_BACKUP_PW",
    })
    const json = JSON.stringify(result)
    expect(json).not.toContain("SUPER_SECRET_PROXY_PW")
    expect(json).not.toContain("SUPER_SECRET_BACKUP_PW")
  })

  it("parses null qbitmanageTags into defaults", () => {
    const result = serializeSettingsResponse({ ...baseRow, qbitmanageTags: null })
    expect(result.qbitmanageTags).toHaveProperty("issue")
    expect(result.qbitmanageTags.issue.enabled).toBe(true)
  })

  it("parses valid JSON qbitmanageTags", () => {
    const tags = JSON.stringify({ issue: { enabled: false, tag: "custom-issue" } })
    const result = serializeSettingsResponse({ ...baseRow, qbitmanageTags: tags })
    expect(result.qbitmanageTags.issue.enabled).toBe(false)
    expect(result.qbitmanageTags.issue.tag).toBe("custom-issue")
  })

  it("returns all expected keys and no encrypted keys", () => {
    const result = serializeSettingsResponse(baseRow)
    const keys = Object.keys(result)
    expect(keys).toContain("storeUsernames")
    expect(keys).toContain("hasProxyPassword")
    expect(keys).toContain("hasBackupPassword")
    expect(keys).toContain("qbitmanageTags")
    expect(keys).not.toContain("encryptedProxyPassword")
    expect(keys).not.toContain("encryptedBackupPassword")
    expect(keys).not.toContain("passwordHash")
    expect(keys).not.toContain("encryptionSalt")
  })
})

// ---------------------------------------------------------------------------
// 3. serializeTrackerResponse: encryptedApiToken excluded (via tracker-serializer)
// ---------------------------------------------------------------------------

describe("serializeTrackerResponse excludes encryptedApiToken", () => {
  it("TrackerSummary (from serializeTrackerResponse) has no encryptedApiToken key", async () => {
    const { serializeTrackerResponse } = await import("@/lib/tracker-serializer")

    const mockTracker = {
      id: 1,
      name: "Test",
      baseUrl: "https://example.com",
      apiPath: "/api/user",
      platformType: "unit3d",
      encryptedApiToken: "SECRET_CIPHERTEXT_MUST_NOT_LEAK",
      isActive: true,
      lastPolledAt: null,
      lastError: null,
      consecutiveFailures: 0,
      pausedAt: null,
      userPausedAt: null,
      color: "#00d4ff",
      qbtTag: null,
      remoteUserId: null,
      platformMeta: null,
      avatarData: null,
      avatarCachedAt: null,
      avatarRemoteUrl: null,
      useProxy: false,
      countCrossSeedUnsatisfied: false,
      isFavorite: false,
      sortOrder: null,
      joinedAt: null,
      lastAccessAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = serializeTrackerResponse(mockTracker, null, (v) => v ?? null)
    const json = JSON.stringify(result)

    expect(result).not.toHaveProperty("encryptedApiToken")
    expect(json).not.toContain("SECRET_CIPHERTEXT_MUST_NOT_LEAK")
    expect(json).not.toContain("encryptedApiToken")
  })
})

// ---------------------------------------------------------------------------
// 4. trackerColumns: encryptedApiToken structurally excluded at query level
// ---------------------------------------------------------------------------

describe("trackerColumns security invariant", () => {
  const columnKeys = Object.keys(trackerColumns)

  it("does NOT include encryptedApiToken", () => {
    expect(columnKeys).not.toContain("encryptedApiToken")
  })

  it("does NOT include avatarData (large binary, served via dedicated route)", () => {
    expect(columnKeys).not.toContain("avatarData")
    expect(columnKeys).not.toContain("avatarCachedAt")
    expect(columnKeys).not.toContain("avatarRemoteUrl")
  })

  it("includes all safe tracker columns used by serializeTrackerResponse", () => {
    const expectedKeys = [
      "id",
      "name",
      "baseUrl",
      "platformType",
      "isActive",
      "lastPolledAt",
      "lastError",
      "consecutiveFailures",
      "pausedAt",
      "color",
      "qbtTag",
      "useProxy",
      "countCrossSeedUnsatisfied",
      "isFavorite",
      "sortOrder",
      "joinedAt",
      "lastAccessAt",
      "remoteUserId",
      "platformMeta",
      "createdAt",
    ]
    for (const key of expectedKeys) {
      expect(columnKeys).toContain(key)
    }
  })
})
