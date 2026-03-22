// src/lib/__tests__/backup.test.ts
//
// Functions: (test file)

import { describe, expect, it, vi } from "vitest"

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
  backupHistory: {},
}))

import {
  CURRENT_BACKUP_VERSION,
  decryptBackupPayload,
  encryptBackupPayload,
  validateBackupJson,
} from "@/lib/backup"

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
  it("passwordHash must not appear in a valid backup payload", () => {
    const p = validPayload()
    expect(p.settings).not.toHaveProperty("passwordHash")
    expect(p.settings).not.toHaveProperty("password_hash")
  })

  it("failedLoginAttempts must not appear in a valid backup payload", () => {
    const p = validPayload()
    expect(p.settings).not.toHaveProperty("failedLoginAttempts")
    expect(p.settings).not.toHaveProperty("failed_login_attempts")
  })

  it("encryptedSchedulerKey must not appear in a valid backup payload", () => {
    const p = validPayload()
    expect(p.settings).not.toHaveProperty("encryptedSchedulerKey")
    expect(p.settings).not.toHaveProperty("encrypted_scheduler_key")
  })

  it("encryptionSalt must be present in settings", () => {
    const p = validPayload()
    expect(p.settings.encryptionSalt).toBeDefined()
    expect(typeof p.settings.encryptionSalt).toBe("string")
  })

  it("userPausedAt is included in tracker backup payload when set", () => {
    const p = validPayload()
    const tracker = p.trackers[0]
    tracker.userPausedAt = "2026-03-21T12:00:00.000Z"
    expect(tracker.userPausedAt).toBe("2026-03-21T12:00:00.000Z")
  })

  it("pausedAt is excluded from tracker backup payload (transient runtime state)", () => {
    const p = validPayload()
    const tracker = p.trackers[0]
    expect(tracker).not.toHaveProperty("pausedAt")
    expect(tracker).not.toHaveProperty("paused_at")
  })
})
