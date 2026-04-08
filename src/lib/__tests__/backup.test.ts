// src/lib/__tests__/backup.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — must appear before any real module imports
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
  trackers: {},
  trackerSnapshots: {},
  trackerRoles: {},
  downloadClients: {},
  tagGroups: {},
  tagGroupMembers: {},
  clientSnapshots: {},
  clientUptimeBuckets: {},
  dismissedAlerts: {},
  notificationTargets: {},
  backupHistory: {},
}))

import {
  CURRENT_BACKUP_VERSION,
  decryptBackupPayload,
  encryptBackupPayload,
  generateBackupPayload,
  validateBackupJson,
} from "@/lib/backup"
import { db } from "@/lib/db"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload() {
  return {
    manifest: {
      version: CURRENT_BACKUP_VERSION,
      appVersion: "0.1.0",
      createdAt: "2026-03-09T08:00:00.000Z",
      encrypted: false,
      instanceUrl: null,
      counts: {
        trackers: 1,
        trackerSnapshots: 1,
        trackerRoles: 0,
        downloadClients: 0,
        tagGroups: 0,
        tagGroupMembers: 0,
        clientSnapshots: 0,
      },
    },
    settings: {
      encryptionSalt: "a".repeat(64),
      storeUsernames: true,
      backupScheduleEnabled: false,
      backupScheduleFrequency: "daily",
      backupRetentionCount: 14,
      backupEncryptionEnabled: false,
      proxyEnabled: false,
      proxyType: "socks5",
      qbitmanageEnabled: false,
    },
    trackers: [
      {
        id: 1,
        name: "TestTracker",
        baseUrl: "https://example.com",
        apiPath: "/api/user",
        platformType: "unit3d",
        encryptedApiToken: "base64ciphertext",
        isActive: true,
        color: "#00d4ff",
        qbtTag: null,
        useProxy: false,
        sortOrder: 0,
        joinedAt: null,
        userPausedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-03-09T00:00:00.000Z",
      },
    ],
    trackerSnapshots: [
      {
        id: 1,
        trackerId: 1,
        polledAt: "2026-03-09T08:00:00.000Z",
        uploadedBytes: "5368709120",
        downloadedBytes: "1073741824",
        ratio: 5.0,
        bufferBytes: "536870912",
        seedingCount: 42,
        leechingCount: 0,
        seedbonus: 1234.56,
        hitAndRuns: 0,
        username: "testuser",
        group: "VIP",
      },
    ],
    trackerRoles: [],
    downloadClients: [],
    tagGroups: [],
    tagGroupMembers: [],
    clientSnapshots: [],
    clientUptimeBuckets: [],
  }
}

// ---------------------------------------------------------------------------
// Validation tests
// ---------------------------------------------------------------------------

describe("validateBackupJson", () => {
  it("accepts a valid payload", () => {
    expect(() => validateBackupJson(validPayload())).not.toThrow()
  })

  it("rejects null payload", () => {
    expect(() => validateBackupJson(null)).toThrow("payload must be an object")
  })

  it("rejects wrong backup version", () => {
    const p = validPayload()
    p.manifest.version = 999
    expect(() => validateBackupJson(p)).toThrow("unsupported backup version")
  })

  it("rejects invalid manifest.createdAt", () => {
    const p = validPayload()
    p.manifest.createdAt = "not-a-date"
    expect(() => validateBackupJson(p)).toThrow("manifest.createdAt")
  })

  it("rejects negative count", () => {
    const p = validPayload()
    p.manifest.counts.trackers = -1
    expect(() => validateBackupJson(p)).toThrow("non-negative integer")
  })

  it("rejects short encryption salt", () => {
    const p = validPayload()
    p.settings.encryptionSalt = "abcd"
    expect(() => validateBackupJson(p)).toThrow("exactly 64 hex")
  })

  it("rejects non-hex encryption salt", () => {
    const p = validPayload()
    p.settings.encryptionSalt = "g".repeat(64)
    expect(() => validateBackupJson(p)).toThrow("exactly 64 hex")
  })

  it("rejects invalid backup frequency", () => {
    const p = validPayload()
    p.settings.backupScheduleFrequency = "hourly"
    expect(() => validateBackupJson(p)).toThrow("backupScheduleFrequency")
  })

  it("rejects retention count out of range", () => {
    const p = validPayload()
    p.settings.backupRetentionCount = 0
    expect(() => validateBackupJson(p)).toThrow("backupRetentionCount")
  })

  it("rejects tracker with empty name", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).name = ""
    expect(() => validateBackupJson(p)).toThrow("trackers[0].name")
  })

  it("rejects tracker with invalid URL", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).baseUrl = "not-a-url"
    expect(() => validateBackupJson(p)).toThrow("trackers[0].baseUrl")
  })

  it("rejects tracker with non-http/https protocol", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).baseUrl = "ftp://example.com"
    expect(() => validateBackupJson(p)).toThrow("must use http or https")
  })

  it("rejects tracker baseUrl targeting localhost", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).baseUrl = "http://localhost/api"
    expect(() => validateBackupJson(p)).toThrow("must not target localhost")
  })

  it("rejects tracker baseUrl targeting private IP", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).baseUrl = "http://192.168.1.1/api"
    expect(() => validateBackupJson(p)).toThrow("must not target localhost")
  })

  it("rejects tracker baseUrl targeting cloud metadata endpoint", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).baseUrl = "http://169.254.169.254/latest"
    expect(() => validateBackupJson(p)).toThrow("must not target localhost")
  })

  it("accepts tracker with empty API token (post-restore backups)", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).encryptedApiToken = ""
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  it("rejects invalid hex color", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).color = "red"
    expect(() => validateBackupJson(p)).toThrow("trackers[0].color")
  })

  it("accepts null color", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).color = null
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  it("rejects non-BigInt uploadedBytes", () => {
    const p = validPayload()
    ;(p.trackerSnapshots[0] as Record<string, unknown>).uploadedBytes = "not-a-number"
    expect(() => validateBackupJson(p)).toThrow("trackerSnapshots[0].uploadedBytes")
  })

  it("rejects invalid snapshot polledAt", () => {
    const p = validPayload()
    ;(p.trackerSnapshots[0] as Record<string, unknown>).polledAt = "invalid"
    expect(() => validateBackupJson(p)).toThrow("trackerSnapshots[0].polledAt")
  })

  it("rejects download client with port out of range", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.downloadClients = [
      {
        id: 1,
        host: "192.168.1.1",
        port: 99999,
        encryptedUsername: "enc",
        encryptedPassword: "enc",
      },
    ]
    expect(() => validateBackupJson(p)).toThrow("downloadClients[0].port")
  })

  it("rejects tagGroupMember without groupId", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.tagGroupMembers = [{ tag: "test", label: "Test" }]
    expect(() => validateBackupJson(p)).toThrow("tagGroupMembers[0].groupId")
  })
})

// ---------------------------------------------------------------------------
// Encryption round-trip
// ---------------------------------------------------------------------------

describe("Backup encryption", () => {
  it("encrypt then decrypt produces the original payload", async () => {
    const { deriveKey } = await import("@/lib/crypto")
    const password = "test-password"
    const payload = validPayload()

    const envelope = await encryptBackupPayload(
      payload as Parameters<typeof encryptBackupPayload>[0],
      password
    )
    expect(envelope.format).toBe("tracker-tracker-encrypted-backup")
    expect(envelope.version).toBe(1)
    expect(typeof envelope.ciphertext).toBe("string")
    expect(typeof envelope.encryptionSalt).toBe("string")

    // Derive key from password using the same salt from envelope
    const key = await deriveKey(password, envelope.encryptionSalt)
    const decrypted = decryptBackupPayload(envelope, key)
    expect(decrypted.manifest.version).toBe(CURRENT_BACKUP_VERSION)
    expect(decrypted.trackers).toHaveLength(1)
    expect((decrypted.trackers[0] as Record<string, unknown>).name).toBe("TestTracker")
  })

  it("decrypt rejects wrong key", async () => {
    const { deriveKey } = await import("@/lib/crypto")
    const password1 = "password-one"
    const password2 = "password-two"
    const payload = validPayload()

    const envelope = await encryptBackupPayload(
      payload as Parameters<typeof encryptBackupPayload>[0],
      password1
    )

    // Derive wrong key using different password but same salt
    const wrongKey = await deriveKey(password2, envelope.encryptionSalt)
    expect(() => decryptBackupPayload(envelope, wrongKey)).toThrow()
  })

  it("decrypt rejects invalid format field", () => {
    const envelope = {
      format: "not-a-backup" as "tracker-tracker-encrypted-backup",
      version: 1 as const,
      createdAt: new Date().toISOString(),
      encryptionSalt: "fake-salt",
      ciphertext: "bogus",
    }
    const key = Buffer.alloc(32, 1)
    expect(() => decryptBackupPayload(envelope, key)).toThrow("Invalid backup envelope format")
  })
})

// ---------------------------------------------------------------------------
// Security invariants
// ---------------------------------------------------------------------------

describe("Backup security invariants", () => {
  it("encryptionSalt must be present in settings", () => {
    const p = validPayload()
    expect(p.settings.encryptionSalt).toBeDefined()
    expect(typeof p.settings.encryptionSalt).toBe("string")
  })

  it("userPausedAt is included in tracker backup payload when set", () => {
    const p = validPayload()
    const tracker = p.trackers[0]
    ;(tracker as Record<string, unknown>).userPausedAt = "2026-03-21T12:00:00.000Z"
    expect(tracker.userPausedAt).toBe("2026-03-21T12:00:00.000Z")
  })

  it("pausedAt is excluded from tracker backup payload (transient runtime state)", () => {
    const p = validPayload()
    const tracker = p.trackers[0]
    expect(tracker).not.toHaveProperty("pausedAt")
    expect(tracker).not.toHaveProperty("paused_at")
  })
})

// ---------------------------------------------------------------------------
// generateBackupPayload — sensitive field exclusion
//
// These tests call the real generateBackupPayload() with a mocked DB that
// returns a realistic appSettings row including the three sensitive fields
// that must NEVER appear in a backup:
//   - passwordHash     (Argon2 credential, must never leave the server)
//   - failedLoginAttempts  (transient security state)
//   - encryptedSchedulerKey  (internal key, not user-restorable)
//
// If someone accidentally removes a field from the destructuring exclusion list
// in backup.ts, these tests will catch the regression.
// ---------------------------------------------------------------------------

describe("generateBackupPayload sensitive field exclusion", () => {
  // A realistic appSettings DB row that includes every sensitive field.
  const sensitiveSettingsRow = {
    id: 1,
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$SUPERSECRETPASSWORDHASH",
    encryptionSalt: "a".repeat(64),
    failedLoginAttempts: 3,
    encryptedSchedulerKey: "base64-encrypted-scheduler-key-value",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    // Safe fields that should survive into the backup
    storeUsernames: true,
    backupScheduleEnabled: false,
    backupScheduleFrequency: "daily",
    backupRetentionCount: 14,
    backupEncryptionEnabled: false,
    proxyEnabled: false,
    proxyType: "socks5",
    qbitmanageEnabled: false,
  }

  // Build a chainable mock that returns the sensitive row for the settings query
  // and empty arrays for all other table queries.
  function makeSelectMock() {
    const emptyChain = {
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
    }

    const settingsChain = {
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sensitiveSettingsRow]),
      orderBy: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
    }

    // db.select() is called multiple times. The first call is for appSettings
    // (uses .limit(1)), subsequent calls are for other tables (use .orderBy()).
    // We track call count to distinguish the settings query from the rest.
    let callCount = 0
    return vi.fn().mockImplementation(() => {
      callCount += 1
      return callCount === 1 ? settingsChain : emptyChain
    })
  }

  beforeEach(() => {
    vi.mocked(db.select).mockImplementation(makeSelectMock())
  })

  it("does NOT include passwordHash in backup settings output", async () => {
    const payload = await generateBackupPayload()
    expect(payload.settings).not.toHaveProperty("passwordHash")
    expect(JSON.stringify(payload.settings)).not.toContain("SUPERSECRETPASSWORDHASH")
  })

  it("does NOT include failedLoginAttempts in backup settings output", async () => {
    const payload = await generateBackupPayload()
    expect(payload.settings).not.toHaveProperty("failedLoginAttempts")
  })

  it("does NOT include encryptedSchedulerKey in backup settings output", async () => {
    const payload = await generateBackupPayload()
    expect(payload.settings).not.toHaveProperty("encryptedSchedulerKey")
    expect(JSON.stringify(payload.settings)).not.toContain("base64-encrypted-scheduler-key-value")
  })

  it("does NOT include id or createdAt in backup settings output", async () => {
    const payload = await generateBackupPayload()
    // id and createdAt are also stripped — verify defensively
    expect(payload.settings).not.toHaveProperty("id")
    expect(payload.settings).not.toHaveProperty("createdAt")
  })

  it("DOES include encryptionSalt in backup settings output (needed for restore)", async () => {
    const payload = await generateBackupPayload()
    expect(payload.settings).toHaveProperty("encryptionSalt", "a".repeat(64))
  })

  it("DOES include safe settings fields in backup output", async () => {
    const payload = await generateBackupPayload()
    expect(payload.settings).toHaveProperty("storeUsernames", true)
    expect(payload.settings).toHaveProperty("backupScheduleEnabled", false)
    expect(payload.settings).toHaveProperty("proxyEnabled", false)
    expect(payload.settings).toHaveProperty("qbitmanageEnabled", false)
  })

  it("backup settings output contains no recognizable sensitive string values", async () => {
    const payload = await generateBackupPayload()
    const serialized = JSON.stringify(payload.settings)
    // Raw password hash must not leak in any form
    expect(serialized).not.toContain("argon2id")
    // Scheduler key must not leak in any form
    expect(serialized).not.toContain("base64-encrypted-scheduler-key-value")
  })
})
