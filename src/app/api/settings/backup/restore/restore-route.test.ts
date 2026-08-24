// src/app/api/settings/backup/restore/restore-route.test.ts
//
// Exercises the body of POST /api/settings/backup/restore, the credential
// re-encryption paths that decide whether a restored instance can still talk to
// its trackers and download clients.
//
// Crypto is deliberately NOT mocked: the whole point is the key-derivation
// round trip (deriveKey -> encrypt -> reencrypt -> decrypt). @/lib/backup is
// also real, so the fixtures below must survive validateBackupJson, that is
// what stops a fixture from silently omitting a field the route reads.

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { verifyPassword } from "@/lib/auth"
import { type BackupPayload, encryptBackupPayload } from "@/lib/backup"
import { decrypt, deriveKey, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { checkLockout } from "@/lib/lockout"
import { log } from "@/lib/logger"
import { ensureSchedulerRunning, stopScheduler } from "@/lib/scheduler"
import { POST } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

// Sentinel objects so an insert/delete can be traced back to its table.
vi.mock("@/lib/db/schema", () => ({
  appCoverageGaps: { __table: "app_coverage_gaps" },
  trackerOutages: { __table: "tracker_outages" },
  // appLiveness is absent on purpose: restore must never touch it. See the
  // exclusion comment in backup.ts.
  appSettings: { id: "app_settings.id" },
  backupHistory: { __table: "backup_history" },
  clientSnapshots: { __table: "client_snapshots" },
  clientUptimeBuckets: { __table: "client_uptime_buckets" },
  dismissedAlerts: { __table: "dismissed_alerts" },
  downloadClients: { __table: "download_clients", id: "download_clients.id" },
  notificationDeliveryState: { __table: "notification_delivery_state" },
  notificationTargets: { __table: "notification_targets" },
  tagGroupMembers: { __table: "tag_group_members" },
  tagGroups: { __table: "tag_groups", id: "tag_groups.id" },
  trackerRoles: { __table: "tracker_roles" },
  trackerSnapshots: { __table: "tracker_snapshots" },
  trackers: { __table: "trackers", id: "trackers.id" },
}))

vi.mock("@/lib/lockout", () => ({
  checkLockout: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetFailedAttempts: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Importing the real scheduler registers process signal handlers.
vi.mock("@/lib/scheduler", () => ({
  ensureSchedulerRunning: vi.fn(),
  stopScheduler: vi.fn(),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SALT_A = "a1b2c3d4".repeat(8) // 64 hex chars, the backup's salt
const SALT_B = "f0e1d2c3".repeat(8) // 64 hex chars, a re-setup instance's salt

const PASSWORD = "correct-horse-battery"
const OTHER_PASSWORD = "a-completely-different-master-pw"
const ENVELOPE_PASSWORD = "backup-file-password" // guards the file, not the fields

const ISO = "2026-01-01T00:00:00.000Z"

const PLAIN = {
  trackerToken: "tracker-api-token-plaintext",
  clientUsername: "qbt-user",
  clientPassword: "qbt-password",
  notificationConfig: '{"webhookUrl":"https://example.com/hook"}',
  proxyPassword: "proxy-secret",
  backupPassword: "backup-secret",
  ptpimgApiKey: "ptpimg-key",
  totpSecret: "JBSWY3DPEHPK3PXP",
  totpBackupCodes: '["11111111","22222222"]',
}

type Ciphertexts = Record<keyof typeof PLAIN, string>

/** Encrypt every secret in PLAIN under `key`, as a real backup would hold them. */
function encryptAll(key: Buffer): Ciphertexts {
  const out = {} as Ciphertexts
  for (const field of Object.keys(PLAIN) as Array<keyof typeof PLAIN>) {
    out[field] = encrypt(PLAIN[field], key)
  }
  return out
}

/**
 * A complete backup payload. Every field the route reads is spelled out here as
 * a literal rather than assembled from a partial map, so a field cannot go
 * missing without this file changing.
 */
function makeBackupPayload(encryptionSalt: string, ct: Ciphertexts): BackupPayload {
  return {
    manifest: {
      version: 1,
      appVersion: "1.0.0",
      instanceUrl: null,
      createdAt: ISO,
      encrypted: false,
      counts: {
        trackers: 1,
        trackerSnapshots: 1,
        trackerRoles: 1,
        downloadClients: 1,
        tagGroups: 1,
        tagGroupMembers: 1,
        clientSnapshots: 1,
        clientUptimeBuckets: 1,
        dismissedAlerts: 1,
        notificationTargets: 1,
      },
    },
    settings: {
      encryptionSalt,
      username: "alice",
      storeUsernames: true,
      totpSecret: ct.totpSecret,
      totpBackupCodes: ct.totpBackupCodes,
      sessionTimeoutMinutes: 60,
      lockoutEnabled: true,
      lockoutThreshold: 5,
      lockoutDurationMinutes: 15,
      snapshotRetentionDays: 90,
      trackerPollIntervalMinutes: 60,
      proxyEnabled: true,
      proxyType: "socks5",
      proxyHost: "proxy.example.com",
      proxyPort: 1080,
      proxyUsername: "proxyuser",
      encryptedProxyPassword: ct.proxyPassword,
      qbitmanageEnabled: false,
      qbitmanageTags: null,
      backupScheduleEnabled: true,
      backupScheduleFrequency: "daily",
      backupRetentionCount: 7,
      backupEncryptionEnabled: true,
      encryptedBackupPassword: ct.backupPassword,
      backupStoragePath: null,
      encryptedPtpimgApiKey: ct.ptpimgApiKey,
      encryptedOeimgApiKey: null,
      encryptedImgbbApiKey: null,
      draftQuicklinks: null,
      dashboardSettings: null,
    },
    trackers: [
      {
        id: 1,
        name: "Test Tracker",
        baseUrl: "https://tracker.example.com",
        apiPath: "/api/v1",
        platformType: "unit3d",
        encryptedApiToken: ct.trackerToken,
        isActive: true,
        color: "#ff0000",
        qbtTag: "tt",
        remoteUserId: 42,
        platformMeta: null,
        avatarData: null,
        avatarCachedAt: null,
        avatarRemoteUrl: null,
        useProxy: false,
        countCrossSeedUnsatisfied: false,
        isFavorite: true,
        sortOrder: 1,
        joinedAt: "2020-01-01",
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
    trackerSnapshots: [
      {
        id: 1,
        trackerId: 1,
        polledAt: ISO,
        uploadedBytes: "1000",
        downloadedBytes: "500",
        ratio: 2,
        bufferBytes: "250",
        seedingCount: 10,
        leechingCount: 1,
        seedbonus: 100,
        hitAndRuns: 0,
        requiredRatio: 1,
        warned: false,
        freeleechTokens: 3,
        shareScore: 50,
        username: "alice",
        group: "User",
      },
    ],
    trackerRoles: [{ id: 1, trackerId: 1, roleName: "Power User", achievedAt: ISO, notes: null }],
    downloadClients: [
      {
        id: 1,
        name: "qbt",
        type: "qbittorrent",
        enabled: true,
        host: "client.example.com",
        port: 8080,
        useSsl: false,
        encryptedUsername: ct.clientUsername,
        encryptedPassword: ct.clientPassword,
        pollIntervalSeconds: 300,
        isDefault: true,
        crossSeedTags: ["cross-seed"],
        errorSince: null,
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
    tagGroups: [
      {
        id: 1,
        name: "Movies",
        emoji: null,
        chartType: "bar",
        description: null,
        sortOrder: 0,
        countUnmatched: false,
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
    tagGroupMembers: [
      { id: 1, groupId: 1, tag: "movie", label: "Movies", color: null, sortOrder: 0 },
    ],
    clientSnapshots: [
      {
        id: 1,
        clientId: 1,
        polledAt: ISO,
        totalSeedingCount: 5,
        totalLeechingCount: 0,
        uploadSpeedBytes: "100",
        downloadSpeedBytes: "0",
        tagStats: null,
      },
    ],
    clientUptimeBuckets: [{ id: 1, clientId: 1, bucketTs: ISO, ok: 10, fail: 0 }],
    dismissedAlerts: [
      { id: 1, alertKey: "tracker-down-1", alertType: "tracker_down", dismissedAt: ISO },
    ],
    notificationTargets: [
      {
        id: 1,
        name: "discord",
        type: "discord",
        enabled: true,
        encryptedConfig: ct.notificationConfig,
        notifyRatioDrop: true,
        notifyHitAndRun: true,
        notifyTrackerDown: true,
        notifyBufferMilestone: false,
        notifyWarned: false,
        notifyRatioDanger: false,
        notifyZeroSeeding: false,
        notifyRankChange: false,
        notifyAnniversary: false,
        thresholds: null,
        includeTrackerName: true,
        scope: null,
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
  }
}

// ─── Mock plumbing ────────────────────────────────────────────────────────────

interface InsertCall {
  table: unknown
  values: Record<string, unknown>
}

interface TxRecorder {
  deletes: unknown[]
  inserts: InsertCall[]
  settingsUpdate: Record<string, unknown> | null
}

/**
 * A tx double whose `values()` result is awaitable and also carries the
 * `.returning()` / `.onConflictDoNothing()` builders the route chains onto it.
 */
function createTx(): { tx: Record<string, unknown>; recorder: TxRecorder } {
  const recorder: TxRecorder = { deletes: [], inserts: [], settingsUpdate: null }
  let nextId = 100

  const tx = {
    delete: vi.fn((table: unknown) => {
      recorder.deletes.push(table)
      return Promise.resolve([])
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: Record<string, unknown> | Record<string, unknown>[]) => {
        for (const row of Array.isArray(values) ? values : [values]) {
          recorder.inserts.push({ table, values: row })
        }
        return Object.assign(Promise.resolve([]), {
          returning: () => Promise.resolve([{ id: nextId++ }]),
          onConflictDoNothing: () => Promise.resolve([]),
        })
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        recorder.settingsUpdate = values
        return { where: vi.fn(() => Promise.resolve([])) }
      }),
    })),
  }

  return { tx, recorder }
}

function mockCurrentSettings(overrides: Record<string, unknown> = {}) {
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        {
          id: 1,
          passwordHash: "argon2-hash",
          encryptionSalt: SALT_B,
          totpSecret: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lockoutEnabled: true,
          ...overrides,
        },
      ]),
    }),
  })
}

function makeRequest(
  payload: unknown,
  masterPassword: string,
  backupPassword?: string,
  dryRun?: boolean
): Request {
  const formData = new FormData()
  formData.append(
    "file",
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    "backup.json"
  )
  formData.append("masterPassword", masterPassword)
  if (backupPassword !== undefined) formData.append("backupPassword", backupPassword)
  if (dryRun !== undefined) formData.append("dryRun", String(dryRun))

  const req = new Request("http://localhost/api/settings/backup/restore", { method: "POST" })
  // Node's Request has no working formData() here, same trick as security.test.ts.
  req.formData = vi.fn().mockResolvedValue(formData)
  return req
}

/** The single row inserted into `table`. Fails loudly if the count isn't one. */
function onlyInsert(recorder: TxRecorder, tableName: string): Record<string, unknown> {
  const rows = recorder.inserts.filter(
    (i) => (i.table as { __table?: string }).__table === tableName
  )
  expect(rows).toHaveLength(1)
  return rows[0].values
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/settings/backup/restore — credential re-encryption", () => {
  let recorder: TxRecorder

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: "ab".repeat(32),
    })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(checkLockout as ReturnType<typeof vi.fn>).mockReturnValue(null)

    const created = createTx()
    recorder = created.recorder
    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(created.tx)
    )
  })

  // ─── 1. Cross-salt round trip: the disaster-recovery path ────────────────────

  it("re-encrypts every credential under the current salt when the salts differ", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // Every assertion below decrypts with a key derived from the CURRENT salt.
    const currentKey = await deriveKey(PASSWORD, SALT_B)

    const tracker = onlyInsert(recorder, "trackers")
    expect(decrypt(tracker.encryptedApiToken as string, currentKey)).toBe(PLAIN.trackerToken)
    // Proves re-encryption actually happened rather than a pass-through.
    expect(tracker.encryptedApiToken).not.toBe(payload.trackers[0].encryptedApiToken)

    const client = onlyInsert(recorder, "download_clients")
    expect(decrypt(client.encryptedUsername as string, currentKey)).toBe(PLAIN.clientUsername)
    expect(decrypt(client.encryptedPassword as string, currentKey)).toBe(PLAIN.clientPassword)
    // Credentials survived, so the client stays enabled and unflagged.
    expect(client.enabled).toBe(true)
    expect(client.lastError).toBeNull()

    const target = onlyInsert(recorder, "notification_targets")
    expect(decrypt(target.encryptedConfig as string, currentKey)).toBe(PLAIN.notificationConfig)
    expect(target.enabled).toBe(true)

    const settings = recorder.settingsUpdate
    expect(settings).not.toBeNull()
    expect(decrypt(settings?.encryptedProxyPassword as string, currentKey)).toBe(
      PLAIN.proxyPassword
    )
    expect(decrypt(settings?.encryptedBackupPassword as string, currentKey)).toBe(
      PLAIN.backupPassword
    )
    expect(decrypt(settings?.encryptedPtpimgApiKey as string, currentKey)).toBe(PLAIN.ptpimgApiKey)
    expect(decrypt(settings?.totpSecret as string, currentKey)).toBe(PLAIN.totpSecret)
    expect(decrypt(settings?.totpBackupCodes as string, currentKey)).toBe(PLAIN.totpBackupCodes)

    const body = await res.json()
    expect(body.tokensPreserved).toBe(1)
    expect(body.tokensCleared).toBe(0)
    expect(body.clientCredentialsCleared).toBe(0)
    expect(body.totpDisabledOnRestore).toBe(false)
  })

  // ─── 2. Same-salt pass-through ───────────────────────────────────────────────

  it("passes ciphertext through byte-for-byte when the salts match", async () => {
    const key = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(key))
    mockCurrentSettings({ encryptionSalt: SALT_A })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    const tracker = onlyInsert(recorder, "trackers")
    expect(tracker.encryptedApiToken).toBe(payload.trackers[0].encryptedApiToken)
    expect(decrypt(tracker.encryptedApiToken as string, key)).toBe(PLAIN.trackerToken)

    const client = onlyInsert(recorder, "download_clients")
    expect(client.encryptedUsername).toBe(payload.downloadClients[0].encryptedUsername)
    expect(decrypt(client.encryptedPassword as string, key)).toBe(PLAIN.clientPassword)
    expect(client.enabled).toBe(true)

    const settings = recorder.settingsUpdate
    expect(settings?.encryptedProxyPassword).toBe(payload.settings.encryptedProxyPassword)
    expect(settings?.totpSecret).toBe(payload.settings.totpSecret)

    const body = await res.json()
    expect(body.tokensPreserved).toBe(1)
    expect(body.tokensCleared).toBe(0)
  })

  // ─── 3. The silent clear at reencryptField (route.ts:78-85) ──────────────────

  it("silently clears every credential when the backup key is wrong, and still reports success", async () => {
    // Cross-salt restore of a backup written under a DIFFERENT master password.
    // The route derives backupKey from the password the user typed now, so every
    // reencrypt() throws and reencryptField swallows it and returns "".
    const wrongBackupKey = await deriveKey(OTHER_PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(wrongBackupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))

    const tracker = onlyInsert(recorder, "trackers")
    expect(tracker.encryptedApiToken).toBe("")

    const client = onlyInsert(recorder, "download_clients")
    expect(client.encryptedUsername).toBe("")
    expect(client.encryptedPassword).toBe("")
    // The download client at least gets disabled and flagged.
    expect(client.enabled).toBe(false)
    expect(client.lastError).toBe("Credentials cleared during restore. Re-enter and re-enable")

    const target = onlyInsert(recorder, "notification_targets")
    expect(target.encryptedConfig).toBe("")
    expect(target.enabled).toBe(false)
    expect(target.lastDeliveryError).toBe("Config cleared during restore. Re-enter and re-enable")

    const settings = recorder.settingsUpdate
    expect(settings?.encryptedProxyPassword).toBeNull()
    expect(settings?.encryptedBackupPassword).toBeNull()
    expect(settings?.encryptedPtpimgApiKey).toBeNull()
    expect(settings?.totpSecret).toBeNull()
    expect(settings?.totpBackupCodes).toBeNull()

    // The only signal that the instance just lost every secret it had.
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ field: "tracker 'Test Tracker' apiToken" }),
      "Failed to re-encrypt field during restore, value will be cleared"
    )

    // Pinning current behaviour: total credential loss is reported as a success.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.tokensPreserved).toBe(0)
    expect(body.tokensCleared).toBe(1)
    expect(body.clientCredentialsCleared).toBe(1)
    expect(body.totpDisabledOnRestore).toBe(true)
  })

  // ─── 4. Wrong master password must not write anything ────────────────────────

  it("writes nothing and leaves the scheduler alone when the master password is wrong", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const res = await POST(makeRequest(payload, OTHER_PASSWORD))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "Invalid master password" })
    // No partial writes, and the scheduler was never stopped.
    expect(db.transaction).not.toHaveBeenCalled()
    expect(stopScheduler).not.toHaveBeenCalled()
    expect(recorder.inserts).toHaveLength(0)
    expect(recorder.deletes).toHaveLength(0)
    expect(recorder.settingsUpdate).toBeNull()
  })

  // ─── 5. Same salt, but the password changed since the backup was taken ───────

  it("clears stale credentials when the salt matches but the backup predates a password change", async () => {
    // Regression test. `POST /api/auth/change-password` re-encrypts every field under a
    // NEW key while REUSING the existing encryptionSalt (change-password/route.ts:72),
    // the salt only rotates on nuke/setup/lockdown. So a backup taken before a password
    // change carries a MATCHING salt and OLD-key ciphertext.
    //
    // This used to take the pass-through branch on `sameSalt` alone: the route copied the
    // old-key ciphertext into the DB verbatim, left the client enabled, logged nothing and
    // reported `tokensPreserved: 1`. Every restored credential was undecryptable. The probe
    // in route.ts (see the `canPassThrough` comment) is what stops that. Do not remove it.
    const oldKey = await deriveKey(OTHER_PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(oldKey))
    mockCurrentSettings({ encryptionSalt: SALT_A })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // The stale ciphertext is refused rather than copied through.
    const tracker = onlyInsert(recorder, "trackers")
    expect(tracker.encryptedApiToken).toBe("")
    expect(tracker.encryptedApiToken).not.toBe(payload.trackers[0].encryptedApiToken)

    // The download client is disabled and flagged so the loss is actionable.
    const client = onlyInsert(recorder, "download_clients")
    expect(client.encryptedUsername).toBe("")
    expect(client.encryptedPassword).toBe("")
    expect(client.enabled).toBe(false)
    expect(client.lastError).toBe("Credentials cleared during restore. Re-enter and re-enable")

    // The mismatch is announced once, at the decision point.
    expect(log.warn).toHaveBeenCalledWith(
      { event: "restore_stale_ciphertext" },
      "Backup predates a master password change, so credentials that cannot be re-encrypted will be cleared"
    )

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.tokensPreserved).toBe(0)
    expect(body.tokensCleared).toBe(1)
    expect(body.clientCredentialsCleared).toBe(1)
  })

  it("still passes ciphertext through when the salts match and the key opens the backup", async () => {
    // The probe must not cost the healthy same-salt case anything, covered byte-for-byte
    // by the pass-through test above; this pins that a readable backup is left alone.
    const key = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(key))
    mockCurrentSettings({ encryptionSalt: SALT_A })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    expect(log.warn).not.toHaveBeenCalledWith(
      { event: "restore_stale_ciphertext" },
      expect.any(String)
    )
    await expect(res.json()).resolves.toMatchObject({ tokensPreserved: 1, tokensCleared: 0 })
  })

  it("passes through a same-salt backup that holds no encrypted values at all", async () => {
    // Nothing to probe. An empty backup must not be treated as a key mismatch.
    const empty = Object.fromEntries(Object.keys(PLAIN).map((f) => [f, ""])) as Ciphertexts
    const payload = makeBackupPayload(SALT_A, empty)
    mockCurrentSettings({ encryptionSalt: SALT_A })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    expect(onlyInsert(recorder, "trackers").encryptedApiToken).toBe("")
    expect(log.warn).not.toHaveBeenCalledWith(
      { event: "restore_stale_ciphertext" },
      expect.any(String)
    )
    // No token was there to lose, so nothing is reported as cleared.
    await expect(res.json()).resolves.toMatchObject({ tokensPreserved: 0, tokensCleared: 0 })
  })

  // ─── 6. Envelope trust: apiPath is written verbatim ──────────────────────────

  it("writes apiPath verbatim from the backup with no validation", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    // An absolute URL here would make the tracker client call a foreign host.
    payload.trackers[0].apiPath = "https://attacker.example.net/collect"
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // Pinned as-is: validateBackupJson checks baseUrl but never apiPath.
    expect(onlyInsert(recorder, "trackers").apiPath).toBe("https://attacker.example.net/collect")
  })

  // ─── 7. Orphaned children are skipped, not written ───────────────────────────

  it("skips child rows whose parent id is absent from the backup", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    payload.trackerSnapshots.push({
      id: 2,
      trackerId: 999, // no such tracker in the backup
      polledAt: ISO,
      uploadedBytes: "1",
      downloadedBytes: "1",
    })
    payload.tagGroupMembers.push({ id: 2, groupId: 999, tag: "x", label: "X" })
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    expect(recorder.inserts.filter((i) => i.values.trackerId === 999)).toHaveLength(0)
    const body = await res.json()
    expect(body.orphanedRecordsSkipped).toBe(2)
  })

  // ─── 8. Scheduler lifecycle around the transaction ───────────────────────────

  it("restarts the scheduler it stopped once the restore succeeds", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // The route used to stop polling and never restart it on the success path, leaving
    // the endpoint dependent on a browser loading an authenticated page, (auth)/layout.tsx
    // calls ensureSchedulerRunning on every one, to revive it.
    expect(stopScheduler).toHaveBeenCalledTimes(1)
    expect(ensureSchedulerRunning).toHaveBeenCalledWith("ab".repeat(32))

    // The session survives a restore, so no re-login is required. The stored scheduler key
    // is still cleared, so polling will not survive a process restart until the next login.
    expect(recorder.settingsUpdate?.encryptedSchedulerKey).toBeNull()
    await expect(res.json()).resolves.toMatchObject({ requiresRelogin: false })
  })

  it("rolls back and restarts the scheduler when the transaction throws", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })
    ;(db.transaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("deadlock detected"))

    const res = await POST(makeRequest(payload, PASSWORD))

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: "Backup restore failed" })
    expect(ensureSchedulerRunning).toHaveBeenCalledWith("ab".repeat(32))
  })

  // ─── 9. Never overwrite the credentials that gate access ─────────────────────

  it("never writes passwordHash or encryptionSalt from the backup", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    // A hostile backup cannot smuggle in its own credentials.
    payload.settings.passwordHash = "attacker-controlled-hash"
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    expect(recorder.settingsUpdate).not.toHaveProperty("passwordHash")
    expect(recorder.settingsUpdate).not.toHaveProperty("encryptionSalt")
  })

  // ─── 10. Which tables the wipe touches ───────────────────────────────────────

  it("wipes exactly the tables the backup can restore", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // trackerDailyCheckpoints and torrentDailyCheckpoints are absent here, but
    // both cascade off trackers/downloadClients (schema.ts:400,420) and neither
    // is in BackupPayload, so restore destroys them with nothing to restore from.
    expect(recorder.deletes.map((t) => (t as { __table: string }).__table)).toEqual([
      "dismissed_alerts",
      // app_coverage_gaps is wiped and restored; app_liveness is deliberately
      // neither, because it describes the running process rather than the data.
      "app_coverage_gaps",
      "client_uptime_buckets",
      "client_snapshots",
      "tracker_snapshots",
      "tracker_roles",
      "tag_group_members",
      "tag_groups",
      "notification_delivery_state",
      "notification_targets",
      "download_clients",
      "trackers",
    ])
  })

  // ─── 11. The encrypted-envelope path ─────────────────────────────────────────

  it("decrypts an encrypted envelope and still re-encrypts fields under the current salt", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    // The envelope password is independent of the master password.
    const envelope = await encryptBackupPayload(payload, ENVELOPE_PASSWORD)
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(envelope, PASSWORD, ENVELOPE_PASSWORD))
    expect(res.status).toBe(200)

    const currentKey = await deriveKey(PASSWORD, SALT_B)
    const tracker = onlyInsert(recorder, "trackers")
    expect(decrypt(tracker.encryptedApiToken as string, currentKey)).toBe(PLAIN.trackerToken)
    await expect(res.json()).resolves.toMatchObject({ tokensPreserved: 1, tokensCleared: 0 })
  })

  it("rejects an encrypted envelope opened with the wrong backup password", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const envelope = await encryptBackupPayload(
      makeBackupPayload(SALT_A, encryptAll(backupKey)),
      ENVELOPE_PASSWORD
    )
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(envelope, PASSWORD, "not-the-envelope-password"))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid or corrupted backup file" })
    expect(db.transaction).not.toHaveBeenCalled()
    expect(stopScheduler).not.toHaveBeenCalled()
  })

  it("rejects an encrypted envelope submitted without a backup password", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const envelope = await encryptBackupPayload(
      makeBackupPayload(SALT_A, encryptAll(backupKey)),
      ENVELOPE_PASSWORD
    )
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(envelope, PASSWORD))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: "Backup password is required for encrypted backups",
    })
    expect(db.transaction).not.toHaveBeenCalled()
  })
})

describe("POST /api/settings/backup/restore — auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the authenticate() response without touching the DB", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const res = await POST(makeRequest({}, PASSWORD))

    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })
})

// ─── Dry run ──────────────────────────────────────────────────────────────────
//
// Credentials a restore cannot decrypt are cleared, and the user used to learn
// that only afterwards. The dry run answers the same question in advance, using
// the same code path so the prediction cannot drift from the restore itself.
//
// The load-bearing property is that it writes NOTHING: it returns above
// stopScheduler(), which is the handler's first side effect.

describe("POST /api/settings/backup/restore — dry run", () => {
  let recorder: TxRecorder

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: "ab".repeat(32),
    })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(checkLockout as ReturnType<typeof vi.fn>).mockReturnValue(null)

    const created = createTx()
    recorder = created.recorder
    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(created.tx)
    )
  })

  it("touches nothing — no writes, no scheduler stop", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD, undefined, true))
    expect(res.status).toBe(200)

    // The whole point: a preview must not be destructive.
    expect(stopScheduler).not.toHaveBeenCalled()
    expect(recorder.deletes).toHaveLength(0)
    expect(recorder.inserts).toHaveLength(0)
    expect(recorder.settingsUpdate).toBeNull()
  })

  it("reports every credential as recoverable when the password opens the backup", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD, undefined, true))
    const body = (await res.json()) as {
      dryRun: boolean
      credentialsTotal: number
      credentialsRecoverable: number
      credentialsAtRisk: number
    }

    expect(body.dryRun).toBe(true)
    expect(body.credentialsTotal).toBeGreaterThan(0)
    expect(body.credentialsAtRisk).toBe(0)
    expect(body.credentialsRecoverable).toBe(body.credentialsTotal)
  })

  it("counts credentials written under a different key as at risk", async () => {
    // A backup taken BEFORE a master-password change: same salt, stale ciphertext.
    // This is the case the user most needs warning about, because matching salts
    // make it look safe right up until the credentials are cleared.
    const staleKey = await deriveKey("a-completely-different-password", SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(staleKey))
    mockCurrentSettings({ encryptionSalt: SALT_A })

    const res = await POST(makeRequest(payload, PASSWORD, undefined, true))
    const body = (await res.json()) as {
      credentialsTotal: number
      credentialsRecoverable: number
      credentialsAtRisk: number
      canPassThrough: boolean
    }

    expect(body.credentialsTotal).toBeGreaterThan(0)
    expect(body.credentialsRecoverable).toBe(0)
    expect(body.credentialsAtRisk).toBe(body.credentialsTotal)
    // Matching salts, but the probe proves the key is wrong.
    expect(body.canPassThrough).toBe(false)
  })

  it("performs a real restore when dryRun is absent", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // Proves the dry-run branch is opt-in and cannot swallow a real restore.
    expect(stopScheduler).toHaveBeenCalledTimes(1)
    expect(recorder.inserts.length).toBeGreaterThan(0)
  })
})

// ─── Retention prompt state ───────────────────────────────────────────────────

describe("POST /api/settings/backup/restore — retention prompt state", () => {
  let recorder: TxRecorder

  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: "ab".repeat(32),
    })
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
    ;(checkLockout as ReturnType<typeof vi.fn>).mockReturnValue(null)

    const created = createTx()
    recorder = created.recorder
    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(created.tx)
    )
  })

  it("carries the answered-at stamp over, so a restore does not re-ask", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    ;(payload.settings as Record<string, unknown>).retentionPromptedAt = ISO
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // Restored alongside the policy it belongs to, otherwise the prompt fires again
    // and the user's answer overwrites the retention value just restored.
    expect(recorder.settingsUpdate?.retentionPromptedAt).toEqual(new Date(ISO))
  })

  it("leaves it null for a backup taken before the column existed", async () => {
    const backupKey = await deriveKey(PASSWORD, SALT_A)
    const payload = makeBackupPayload(SALT_A, encryptAll(backupKey))
    // No retentionPromptedAt at all, an older backup.
    mockCurrentSettings({ encryptionSalt: SALT_B })

    const res = await POST(makeRequest(payload, PASSWORD))
    expect(res.status).toBe(200)

    // null correctly means "ask", which is right for a backup that never answered.
    expect(recorder.settingsUpdate?.retentionPromptedAt).toBeNull()
  })
})
