// src/lib/__tests__/backup.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks, must appear before any real module imports
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
  appCoverageGaps: {},
  trackerOutages: {},
  // appLiveness is absent on purpose. See the exclusion test below.
  appSettings: {},
  trackers: {},
  trackerSnapshots: {},
  trackerRoles: {},
  downloadClients: {},
  prowlarrIndexers: {},
  prowlarrInstances: {},
  tagGroups: {},
  tagGroupMembers: {},
  clientSnapshots: {},
  clientUptimeBuckets: {},
  dismissedAlerts: {},
  notificationTargets: {},
  backupHistory: {},
}))

import {
  BACKUP_CLIENT_COLUMNS,
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

  it("rejects a tracker whose platformType is not a supported platform", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).platformType = "torrentz"
    expect(() => validateBackupJson(p)).toThrow(
      "Backup validation: trackers[0].platformType must be one of: unit3d, gazelle"
    )
  })

  it("rejects a tracker whose apiPath is not a string", () => {
    const p = validPayload()
    ;(p.trackers[0] as Record<string, unknown>).apiPath = null
    expect(() => validateBackupJson(p)).toThrow("trackers[0].apiPath must be a string")
  })

  // The column defaults apply to a row without them, and old BTN rows hold an
  // absolute API URL that the restore replaces rather than refuses.
  it("accepts a tracker with no platformType or apiPath, or an absolute apiPath", () => {
    const p = validPayload()
    const tracker = p.trackers[0] as Record<string, unknown>
    delete tracker.platformType
    delete tracker.apiPath
    expect(() => validateBackupJson(p)).not.toThrow()
    tracker.apiPath = "https://api.broadcasthe.net/"
    expect(() => validateBackupJson(p)).not.toThrow()
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

  // The restore turns each into BigInt inside its transaction, after the wipe has begun.
  const BIGINT_FIELDS: [string, string][] = [
    ["trackerSnapshots", "uploadedBytes"],
    ["trackerSnapshots", "downloadedBytes"],
    ["trackerSnapshots", "bufferBytes"],
    ["clientSnapshots", "uploadSpeedBytes"],
    ["clientSnapshots", "downloadSpeedBytes"],
  ]

  function withBigInt(table: string, field: string, value: unknown) {
    const p = validPayload() as unknown as Record<string, unknown>
    p.clientSnapshots = [{ id: 1, clientId: 1, polledAt: "2026-01-01T00:00:00.000Z" }]
    ;(p[table] as Record<string, unknown>[])[0][field] = value
    return p
  }

  it.each(
    BIGINT_FIELDS.flatMap(([table, field]): [string, string, string][] => [
      [table, field, ""],
      [table, field, "1.5"],
      [table, field, "0x10"],
      [table, field, " 5"],
      [table, field, "9223372036854775808"],
    ])
  )("rejects %s %s set to %j", (table, field, value) => {
    expect(() => validateBackupJson(withBigInt(table, field, value))).toThrow(
      `Backup validation: ${table}[0].${field} must be a valid whole number`
    )
  })

  it.each(
    BIGINT_FIELDS.flatMap(([table, field]): [string, string, string][] => [
      [table, field, "0"],
      [table, field, "-536870912"],
      [table, field, "9223372036854775807"],
    ])
  )("accepts %s %s set to %j", (table, field, value) => {
    expect(() => validateBackupJson(withBigInt(table, field, value))).not.toThrow()
  })

  it.each([
    ["trackerSnapshots", "bufferBytes"],
    ["clientSnapshots", "uploadSpeedBytes"],
    ["clientSnapshots", "downloadSpeedBytes"],
  ])("accepts %s %s left null", (table, field) => {
    expect(() => validateBackupJson(withBigInt(table, field, null))).not.toThrow()
  })

  it("rejects invalid snapshot polledAt", () => {
    const p = validPayload()
    ;(p.trackerSnapshots[0] as Record<string, unknown>).polledAt = "invalid"
    expect(() => validateBackupJson(p)).toThrow("trackerSnapshots[0].polledAt")
  })

  // The pattern alone passes both, and the insert throws on the Invalid Date they make.
  it.each([
    ["month 13", "2026-13-01T00:00:00.000Z"],
    ["hour 25", "2026-03-09T25:00:00.000Z"],
  ])("rejects a snapshot polledAt with %s", (_case, polledAt) => {
    const p = validPayload()
    ;(p.trackerSnapshots[0] as Record<string, unknown>).polledAt = polledAt
    expect(() => validateBackupJson(p)).toThrow(
      "trackerSnapshots[0].polledAt must be a valid ISO 8601 string"
    )
  })

  // NaN fails every comparison, so the inversion check alone passes this.
  it("rejects an outage that starts in month 13", () => {
    const p = validPayload() as Record<string, unknown>
    p.trackerOutages = [
      {
        trackerId: 1,
        startedAt: "2026-13-01T00:00:00.000Z",
        endedAt: "2026-03-09T00:00:00.000Z",
        reason: "poll",
      },
    ]
    expect(() => validateBackupJson(p)).toThrow(
      "trackerOutages[0].startedAt must be a valid ISO 8601 string"
    )
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

  // Passes every client check. No authMethod, like a backup from before API-key auth.
  const validClient = () => ({
    id: 1,
    host: "192.168.1.1",
    port: 8080,
    type: "qbittorrent",
    encryptedUsername: "enc",
    encryptedPassword: "enc",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z",
  })

  // The client routes refuse these, so a restore must not store them either.
  it.each([
    ["an unknown type", { type: "deluge" }, "type must be one of"],
    ["no type", { type: undefined }, "type must be a string"],
    ["a numeric type", { type: 1 }, "type must be a string"],
    ["an unknown authMethod", { authMethod: "token" }, "authMethod must be one of"],
    [
      "an API key on Transmission",
      { type: "transmission", authMethod: "apikey" },
      "authMethod apikey is not supported for transmission",
    ],
  ])("rejects a download client with %s", (_case, fields, message) => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.downloadClients = [{ ...validClient(), ...fields }]
    expect(() => validateBackupJson(p)).toThrow(`downloadClients[0].${message}`)
  })

  it("accepts a download client without authMethod", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.downloadClients = [validClient()]
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  it("accepts an API key on a qBittorrent client", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.downloadClients = [{ ...validClient(), authMethod: "apikey" }]
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  // The Prowlarr routes refuse these, so a restore must not store them either.
  it.each([
    "http://user:secret@prowlarr.test:9696",
    "http://prowlarr.test:9696/?apikey=secret",
    "http://prowlarr.test:9696/?",
    "http://prowlarr.test:9696/#",
    "ftp://prowlarr.test",
  ])("rejects a Prowlarr instance with the URL %s", (url) => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.prowlarrInstances = [{ id: 1, name: "Home", url, encryptedApiKey: null }]
    expect(() => validateBackupJson(p)).toThrow("prowlarrInstances[0].url")
  })

  it("accepts a Prowlarr instance on a private host", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.prowlarrInstances = [
      {
        id: 1,
        name: "Home",
        url: "http://192.168.1.10:9696",
        encryptedApiKey: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-03-09T00:00:00.000Z",
      },
    ]
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  // Older backups carry no public URLs, and a null one means links use the stored URL.
  it("accepts absent and null public URLs", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.prowlarrInstances = [
      {
        id: 1,
        name: "Home",
        url: "http://prowlarr:9696",
        publicUrl: null,
        encryptedApiKey: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        name: "Away",
        url: "http://prowlarr:9696",
        encryptedApiKey: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]
    ;(p.trackers as Record<string, unknown>[])[0].mouseholePublicUrl = null
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  it.each([
    [
      "prowlarrInstances[0].publicUrl",
      (p: Record<string, unknown>) => {
        p.prowlarrInstances = [
          {
            id: 1,
            name: "Home",
            url: "http://prowlarr:9696",
            publicUrl: "https://u:p@prowlarr.example.com",
            encryptedApiKey: null,
          },
        ]
      },
    ],
    [
      "trackers[0].mouseholePublicUrl",
      (p: Record<string, unknown>) => {
        ;(p.trackers as Record<string, unknown>[])[0].mouseholePublicUrl = "javascript:alert(1)"
      },
    ],
    [
      "downloadClients[0].publicUrl",
      (p: Record<string, unknown>) => {
        p.downloadClients = [
          {
            host: "qbittorrent",
            port: 8080,
            type: "qbittorrent",
            encryptedUsername: "",
            encryptedPassword: "",
            publicUrl: "qbt.example.com",
          },
        ]
      },
    ],
  ])("rejects an invalid %s", (field, mutate) => {
    const p = validPayload() as unknown as Record<string, unknown>
    mutate(p)
    expect(() => validateBackupJson(p)).toThrow(field)
  })

  it("rejects tagGroupMember without groupId", () => {
    const p = validPayload() as unknown as Record<string, unknown>
    p.tagGroupMembers = [{ tag: "test", label: "Test" }]
    expect(() => validateBackupJson(p)).toThrow("tagGroupMembers[0].groupId")
  })

  // One row in every table whose dates the restore writes back, dated as an export dates it.
  function datedPayload(): Record<string, unknown> {
    const p = validPayload() as unknown as Record<string, unknown>
    const stamp = "2026-01-01T00:00:00.000Z"
    Object.assign((p.trackers as Record<string, unknown>[])[0], {
      userPausedAt: stamp,
      avatarCachedAt: stamp,
      joinedAt: "2020-01-01",
      lastAccessAt: "2026-02-28",
    })
    Object.assign(p.settings as Record<string, unknown>, { retentionPromptedAt: stamp })
    p.trackerRoles = [{ id: 1, trackerId: 1, roleName: "User", achievedAt: stamp, notes: null }]
    p.downloadClients = [validClient()]
    p.tagGroups = [{ id: 1, name: "Movies", createdAt: stamp, updatedAt: stamp }]
    p.clientSnapshots = [{ id: 1, clientId: 1, polledAt: stamp }]
    p.notificationTargets = [
      {
        id: 1,
        name: "Discord",
        type: "discord",
        encryptedConfig: "enc",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]
    p.prowlarrInstances = [
      {
        id: 1,
        name: "Home",
        url: "http://192.168.1.10:9696",
        encryptedApiKey: null,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ]
    return p
  }

  // Sets `field` on settings or on the first row of `table`, and returns its label.
  function setDate(p: Record<string, unknown>, table: string, field: string, value: unknown) {
    if (table === "settings") {
      ;(p.settings as Record<string, unknown>)[field] = value
      return `settings.${field}`
    }
    ;(p[table] as Record<string, unknown>[])[0][field] = value
    return `${table}[0].${field}`
  }

  const REQUIRED_DATES: [string, string][] = [
    ["trackers", "createdAt"],
    ["trackers", "updatedAt"],
    ["trackerRoles", "achievedAt"],
    ["downloadClients", "createdAt"],
    ["downloadClients", "updatedAt"],
    ["tagGroups", "createdAt"],
    ["tagGroups", "updatedAt"],
    ["clientSnapshots", "polledAt"],
    ["notificationTargets", "createdAt"],
    ["notificationTargets", "updatedAt"],
    ["prowlarrInstances", "createdAt"],
    ["prowlarrInstances", "updatedAt"],
  ]
  const NULLABLE_DATES: [string, string][] = [
    ["trackers", "userPausedAt"],
    ["trackers", "avatarCachedAt"],
    ["settings", "retentionPromptedAt"],
  ]
  const CALENDAR_DATES: [string, string][] = [
    ["trackers", "joinedAt"],
    ["trackers", "lastAccessAt"],
  ]

  it("accepts a row in every dated table", () => {
    expect(() => validateBackupJson(datedPayload())).not.toThrow()
  })

  it.each(
    REQUIRED_DATES.flatMap(([table, field]): [string, string, unknown, string][] => [
      [table, field, undefined, "must be a string"],
      [table, field, "not-a-date", "must be a valid ISO 8601 string"],
      [table, field, "2026-02-30T00:00:00.000Z", "must be a valid ISO 8601 string"],
    ])
  )("rejects %s %s set to %s", (table, field, value, message) => {
    const p = datedPayload()
    const label = setDate(p, table, field, value)
    expect(() => validateBackupJson(p)).toThrow(`Backup validation: ${label} ${message}`)
  })

  it.each(
    [...NULLABLE_DATES, ...CALENDAR_DATES].flatMap(
      ([table, field]): [string, string, unknown][] => [
        [table, field, null],
        [table, field, undefined],
      ]
    )
  )("accepts %s %s set to %s", (table, field, value) => {
    const p = datedPayload()
    setDate(p, table, field, value)
    expect(() => validateBackupJson(p)).not.toThrow()
  })

  it.each(
    NULLABLE_DATES.flatMap(([table, field]): [string, string, string][] => [
      [table, field, ""],
      [table, field, "2026-02-30T00:00:00.000Z"],
      [table, field, "not-a-date"],
    ])
  )("rejects %s %s set to %j", (table, field, value) => {
    const p = datedPayload()
    const label = setDate(p, table, field, value)
    expect(() => validateBackupJson(p)).toThrow(
      `Backup validation: ${label} must be a valid ISO 8601 string`
    )
  })

  // Postgres refuses each of these as a date, which would fail the restore's transaction.
  it.each(
    CALENDAR_DATES.flatMap(([table, field]): [string, string, string][] => [
      [table, field, "2024-02-30"],
      [table, field, "2024-13-01"],
      [table, field, ""],
      [table, field, "not-a-date"],
    ])
  )("rejects %s %s set to %j", (table, field, value) => {
    const p = datedPayload()
    const label = setDate(p, table, field, value)
    expect(() => validateBackupJson(p)).toThrow(
      `Backup validation: ${label} must be a valid YYYY-MM-DD date`
    )
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

  it("lastErrorAt is excluded from tracker backup payload (transient runtime state)", () => {
    const p = validPayload()
    const tracker = p.trackers[0]
    expect(tracker).not.toHaveProperty("lastErrorAt")
    expect(tracker).not.toHaveProperty("last_error_at")
  })
})

// ---------------------------------------------------------------------------
// generateBackupPayload, sensitive field exclusion
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
    // id and createdAt are also stripped, verify defensively
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

// ---------------------------------------------------------------------------
// app_liveness must never ride along in a backup
//
// It is one mutable row meaning "the live process was here at this instant".
// Restoring a months-old lastSeenAt would make the next touchAppLiveness()
// measure the distance to now and write a single enormous fabricated outage
// across every chart, an explanation for downtime that never happened.
//
// The guarantee is structural (generateBackupPayload enumerates its tables by
// hand), but "structural" is exactly what a future contributor changes while
// tidying up, so it is pinned here too.
// ---------------------------------------------------------------------------

describe("app liveness ledger exclusion", () => {
  function emptySelectMock() {
    const chain = {
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
    }
    return vi.fn().mockImplementation(() => chain)
  }

  beforeEach(() => {
    vi.mocked(db.select).mockImplementation(emptySelectMock())
  })

  it("does NOT carry app_liveness", async () => {
    const payload = await generateBackupPayload()
    expect(payload).not.toHaveProperty("appLiveness")
    expect(JSON.stringify(payload)).not.toContain("lastSeenAt")
    expect(payload.manifest.counts).not.toHaveProperty("appLiveness")
  })

  it("DOES carry app_coverage_gaps — the snapshots it explains are restored too", async () => {
    const payload = await generateBackupPayload()
    expect(payload).toHaveProperty("appCoverageGaps")
    expect(payload.manifest.counts).toHaveProperty("appCoverageGaps")
  })

  it("DOES carry tracker_outages, for exactly the same reason", async () => {
    // tracker_outages FKs to trackers with ON DELETE CASCADE, so a restore wipes
    // it and re-inserts the snapshots it explained. Omitting it from the backup
    // hands back the flat stretches with every explanation gone, permanently,
    // because the rows are not recoverable from anywhere else.
    const payload = await generateBackupPayload()
    expect(payload).toHaveProperty("trackerOutages")
    expect(payload.manifest.counts).toHaveProperty("trackerOutages")
  })
})

describe("appCoverageGaps validation", () => {
  it("accepts a payload without the field (older backups)", () => {
    const payload = validPayload()
    expect(() => validateBackupJson(payload)).not.toThrow()
  })

  it("rejects a gap whose end precedes its start", () => {
    const payload = validPayload() as Record<string, unknown>
    payload.appCoverageGaps = [
      {
        startedAt: "2026-08-01T12:00:00.000Z",
        endedAt: "2026-08-01T11:00:00.000Z",
        reason: "unclean",
      },
    ]
    expect(() => validateBackupJson(payload)).toThrow(/endedAt must not precede startedAt/)
  })

  it("rejects a gap with a non-ISO timestamp", () => {
    const payload = validPayload() as Record<string, unknown>
    payload.appCoverageGaps = [{ startedAt: "yesterday", endedAt: "today", reason: "unclean" }]
    expect(() => validateBackupJson(payload)).toThrow(/ISO 8601/)
  })

  it("accepts a well-formed gap", () => {
    const payload = validPayload() as Record<string, unknown>
    payload.appCoverageGaps = [
      {
        startedAt: "2026-08-01T11:00:00.000Z",
        endedAt: "2026-08-01T12:00:00.000Z",
        reason: "shutdown",
      },
    ]
    expect(() => validateBackupJson(payload)).not.toThrow()
  })
})

describe("BACKUP_CLIENT_COLUMNS", () => {
  // A credential column missing from the backup projection is not a type
  // error, the payload type is inferred from whatever the projection happens
  // to contain. It surfaces much later, as a restore that quietly comes back
  // without that credential. So assert the columns by name.
  it("carries every credential column a client can authenticate with", () => {
    const keys = Object.keys(BACKUP_CLIENT_COLUMNS)
    for (const key of [
      "authMethod",
      "encryptedUsername",
      "encryptedPassword",
      "encryptedApiKey",
      "encryptedUrlPath",
    ]) {
      expect(keys).toContain(key)
    }
  })

  it("excludes the cached-torrent blobs and transient scheduler state", () => {
    const keys = Object.keys(BACKUP_CLIENT_COLUMNS)
    for (const key of ["cachedTorrents", "cachedTorrentsAt", "lastPolledAt", "lastError"]) {
      expect(keys).not.toContain(key)
    }
  })
})
