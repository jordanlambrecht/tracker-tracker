// src/app/api/auth/change-password/change-password-route.test.ts
//
// Coverage for the master-password rotation handler.
//
// These tests use REAL crypto (deriveKey/encrypt/decrypt from @/lib/crypto)
// because the key-derivation round trip IS the thing under test: a secret
// encrypted under the OLD password must come back out under a key derived
// independently from the NEW password. Only the DB, argon2 hashing, the
// logger and the post-commit side effects are mocked.
//
// Several tests deliberately PIN CURRENT BEHAVIOUR that is arguably wrong
// (skip-and-continue, silent backup-code destruction, unverified session
// key). Each is marked "PINS:" so a future intentional fix fails loudly.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, hashPassword, verifyPassword } from "@/lib/auth"
import { decrypt, deriveKey, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, downloadClients, notificationTargets, trackers } from "@/lib/db/schema"
import { recordFailedAttempt, resetFailedAttempts } from "@/lib/lockout"
import { stopScheduler } from "@/lib/scheduler"
import { clearSchedulerKey } from "@/lib/scheduler-key-store"
import { POST } from "./route"

// decodeKey stays REAL — mocking it to a fixed buffer would defeat the
// entire round trip. Only the session lookup and body parsing are faked.
vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseJsonBody: vi.fn(),
  }
})

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  clearSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { id: "appSettings.id" },
  trackers: {
    id: "trackers.id",
    name: "trackers.name",
    encryptedApiToken: "trackers.encryptedApiToken",
  },
  downloadClients: {
    id: "downloadClients.id",
    name: "downloadClients.name",
    encryptedUsername: "downloadClients.encryptedUsername",
    encryptedPassword: "downloadClients.encryptedPassword",
  },
  notificationTargets: {
    id: "notificationTargets.id",
    name: "notificationTargets.name",
    encryptedConfig: "notificationTargets.encryptedConfig",
  },
}))

vi.mock("@/lib/lockout", () => ({
  recordFailedAttempt: vi.fn(),
  resetFailedAttempts: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock("@/lib/scheduler", () => ({ stopScheduler: vi.fn() }))
vi.mock("@/lib/scheduler-key-store", () => ({ clearSchedulerKey: vi.fn() }))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SALT = "b3f1".repeat(16)
const OLD_PASSWORD = "old-master-password"
const NEW_PASSWORD = "new-master-password"
const NEW_HASH = "argon2-hash-of-new-password"

const TOTP_SECRET = "JBSWY3DPEHPK3PXP"
const BACKUP_CODES = JSON.stringify([{ code: "aaaa-bbbb", usedAt: null }])
const NOTIFICATION_CONFIG = JSON.stringify({ webhookUrl: "https://discord.com/api/webhooks/xyz" })

/** Derived once — scrypt is deliberately slow. */
let oldKey: Buffer
let newKey: Buffer
/** A key that is neither oldKey nor newKey — stands in for a stale session. */
let strangerKey: Buffer

type Row = Record<string, unknown>
type Write = { table: unknown; values: Record<string, unknown> }

let settingsRow: Row
let trackerRows: Row[]
let clientRows: Row[]
let notificationRows: Row[]
/** Every tx.update(...).set(...).where(...) in call order. */
let writes: Write[]
/** When set, any write to this table rejects — simulates an in-tx DB failure. */
let failWritesFor: unknown = null

function makeSettingsRow(overrides: Row = {}): Row {
  return {
    id: 1,
    passwordHash: "argon2-hash-of-old-password",
    encryptionSalt: SALT,
    totpSecret: encrypt(TOTP_SECRET, oldKey),
    totpBackupCodes: encrypt(BACKUP_CODES, oldKey),
    encryptedProxyPassword: encrypt("proxy-pw", oldKey),
    encryptedBackupPassword: encrypt("backup-pw", oldKey),
    encryptedPtpimgApiKey: encrypt("ptpimg-key", oldKey),
    encryptedOeimgApiKey: encrypt("oeimg-key", oldKey),
    encryptedImgbbApiKey: encrypt("imgbb-key", oldKey),
    lockoutEnabled: true,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    ...overrides,
  }
}

function selectFrom(table: unknown) {
  const rows =
    table === appSettings
      ? [settingsRow]
      : table === trackers
        ? trackerRows
        : table === downloadClients
          ? clientRows
          : table === notificationTargets
            ? notificationRows
            : []
  // appSettings is read as .from(x).limit(1); the rest are awaited directly.
  const result = Promise.resolve(rows)
  ;(result as unknown as { limit: (n: number) => Promise<Row[]> }).limit = () =>
    Promise.resolve(rows)
  return result
}

function post(body: unknown = { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD }) {
  ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
  return POST(new Request("http://localhost/api/auth/change-password", { method: "POST" }))
}

function writesTo(table: unknown): Write[] {
  return writes.filter((w) => w.table === table)
}

function settingsWrite(): Record<string, unknown> {
  const found = writesTo(appSettings)
  expect(found).toHaveLength(1)
  return found[0].values
}

beforeAll(async () => {
  oldKey = await deriveKey(OLD_PASSWORD, SALT)
  newKey = await deriveKey(NEW_PASSWORD, SALT)
  strangerKey = await deriveKey("a-completely-different-password", SALT)
})

beforeEach(() => {
  vi.clearAllMocks()
  writes = []
  failWritesFor = null

  settingsRow = makeSettingsRow()
  trackerRows = [
    { id: 1, name: "Alpha", encryptedApiToken: encrypt("alpha-api-token", oldKey) },
    { id: 2, name: "Beta", encryptedApiToken: encrypt("beta-api-token", oldKey) },
  ]
  clientRows = [
    {
      id: 10,
      name: "qbit",
      encryptedUsername: encrypt("admin", oldKey),
      encryptedPassword: encrypt("hunter2", oldKey),
    },
  ]
  notificationRows = [
    { id: 20, name: "discord", encryptedConfig: encrypt(NOTIFICATION_CONFIG, oldKey) },
  ]

  // The session carries the OLD key — this is what decodeKey() unpacks.
  ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
    encryptionKey: oldKey.toString("hex"),
  })
  ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true)
  ;(hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue(NEW_HASH)
  ;(clearSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(resetFailedAttempts as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(recordFailedAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(clearSchedulerKey as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: selectFrom })
  ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => ({
            where: () => {
              if (failWritesFor === table) {
                return Promise.reject(new Error("simulated DB write failure"))
              }
              writes.push({ table, values })
              return Promise.resolve([])
            },
          }),
        }),
      }
      return cb(tx)
    }
  )
})

// ─── The headline round trip ──────────────────────────────────────────────────

describe("POST /api/auth/change-password — re-encryption round trip", () => {
  it("re-encrypts every field so it decrypts under a key derived from the NEW password", async () => {
    const response = await post()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })

    // `newKey` was derived in beforeAll straight from NEW_PASSWORD + SALT,
    // completely independently of anything the handler computed.
    const trackerWrites = writesTo(trackers)
    expect(trackerWrites).toHaveLength(2)
    expect(decrypt(trackerWrites[0].values.encryptedApiToken as string, newKey)).toBe(
      "alpha-api-token"
    )
    expect(decrypt(trackerWrites[1].values.encryptedApiToken as string, newKey)).toBe(
      "beta-api-token"
    )

    const clientWrites = writesTo(downloadClients)
    expect(clientWrites).toHaveLength(1)
    expect(decrypt(clientWrites[0].values.encryptedUsername as string, newKey)).toBe("admin")
    expect(decrypt(clientWrites[0].values.encryptedPassword as string, newKey)).toBe("hunter2")

    const notificationWrites = writesTo(notificationTargets)
    expect(notificationWrites).toHaveLength(1)
    expect(decrypt(notificationWrites[0].values.encryptedConfig as string, newKey)).toBe(
      NOTIFICATION_CONFIG
    )

    const settings = settingsWrite()
    expect(decrypt(settings.totpSecret as string, newKey)).toBe(TOTP_SECRET)
    expect(decrypt(settings.totpBackupCodes as string, newKey)).toBe(BACKUP_CODES)
    expect(decrypt(settings.encryptedProxyPassword as string, newKey)).toBe("proxy-pw")
    expect(decrypt(settings.encryptedBackupPassword as string, newKey)).toBe("backup-pw")
    expect(decrypt(settings.encryptedPtpimgApiKey as string, newKey)).toBe("ptpimg-key")
    expect(decrypt(settings.encryptedOeimgApiKey as string, newKey)).toBe("oeimg-key")
    expect(decrypt(settings.encryptedImgbbApiKey as string, newKey)).toBe("imgbb-key")
  })

  it("writes ciphertext that is no longer readable with the OLD key", async () => {
    await post()

    const token = writesTo(trackers)[0].values.encryptedApiToken as string
    expect(() => decrypt(token, oldKey)).toThrow()
    expect(decrypt(token, newKey)).toBe("alpha-api-token")
  })

  it("reuses the existing salt, so the new key comes from the new password alone", async () => {
    await post()

    // Salt is never rotated (route.ts:72). Same salt + different password must
    // still yield a different key — that is what makes the rotation meaningful.
    const sameSaltNewKey = await deriveKey(NEW_PASSWORD, SALT)
    expect(sameSaltNewKey.equals(oldKey)).toBe(false)
    expect(decrypt(writesTo(trackers)[0].values.encryptedApiToken as string, sameSaltNewKey)).toBe(
      "alpha-api-token"
    )
    expect(settingsWrite().encryptionSalt).toBeUndefined()
  })

  it("writes the new password hash LAST, after every secret has been re-encrypted", async () => {
    await post()

    // The ordering question: the hash lands at the very end of the transaction,
    // so a failure while re-encrypting cannot leave the user holding a new
    // password that does not match their stored secrets.
    const last = writes[writes.length - 1]
    expect(last.table).toBe(appSettings)
    expect(last.values.passwordHash).toBe(NEW_HASH)
    expect(writes.slice(0, -1).every((w) => w.table !== appSettings)).toBe(true)
  })

  it("ends the session and stops the scheduler after a successful commit", async () => {
    await post()

    expect(clearSchedulerKey).toHaveBeenCalledWith(1)
    expect(stopScheduler).toHaveBeenCalled()
    expect(clearSession).toHaveBeenCalled()
  })
})

// ─── Rejection paths ──────────────────────────────────────────────────────────

describe("POST /api/auth/change-password — rejection", () => {
  it("rejects a wrong current password and writes nothing", async () => {
    ;(verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false)

    const response = await post({ currentPassword: "wrong", newPassword: NEW_PASSWORD })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Current password is incorrect" })
    expect(db.transaction).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
    expect(recordFailedAttempt).toHaveBeenCalledWith(1, settingsRow)
    expect(resetFailedAttempts).not.toHaveBeenCalled()
    expect(clearSession).not.toHaveBeenCalled()
  })

  it("rejects a new password shorter than the minimum without touching the DB", async () => {
    const response = await post({ currentPassword: OLD_PASSWORD, newPassword: "short" })

    expect(response.status).toBe(400)
    expect(db.transaction).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
  })
})

// ─── Failure handling — PINNED CURRENT BEHAVIOUR ──────────────────────────────

describe("POST /api/auth/change-password — undecryptable fields", () => {
  it("PINS: a tracker that fails to decrypt is skipped, and the rotation still commits", async () => {
    trackerRows[1] = { id: 2, name: "Beta", encryptedApiToken: encrypt("beta-token", strangerKey) }

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { success: boolean; warnings: string[] }
    expect(body.success).toBe(true)
    expect(body.warnings).toContain(
      "Could not re-encrypt 1 tracker API key(s). Re-enter them manually."
    )

    // Alpha is re-keyed; Beta is silently left behind holding old-key ciphertext.
    const trackerWrites = writesTo(trackers)
    expect(trackerWrites).toHaveLength(1)
    expect(decrypt(trackerWrites[0].values.encryptedApiToken as string, newKey)).toBe(
      "alpha-api-token"
    )
    // The password hash commits anyway — Beta's token is now orphaned forever.
    expect(settingsWrite().passwordHash).toBe(NEW_HASH)
  })

  it("PINS: a client whose password fails to decrypt loses BOTH credentials from the rotation", async () => {
    clientRows[0] = {
      id: 10,
      name: "qbit",
      encryptedUsername: encrypt("admin", oldKey),
      encryptedPassword: encrypt("hunter2", strangerKey),
    }

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { warnings: string[] }
    expect(body.warnings).toContain(
      "Could not re-encrypt 1 client credential(s). Re-enter them manually."
    )
    // The username was perfectly decryptable but shares one try/catch, so it is
    // discarded together with the password and orphaned under the old key.
    expect(writesTo(downloadClients)).toHaveLength(0)
  })

  it("PINS: an undecryptable notification config is skipped and named in the warning", async () => {
    notificationRows[0] = {
      id: 20,
      name: "discord",
      encryptedConfig: encrypt(NOTIFICATION_CONFIG, strangerKey),
    }

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { warnings: string[] }
    expect(body.warnings).toContain(
      "1 notification target(s) could not be re-encrypted and were skipped: discord"
    )
    expect(writesTo(notificationTargets)).toHaveLength(0)
  })

  it("PINS: a failed TOTP secret nulls the secret AND the backup codes, and warns", async () => {
    settingsRow = makeSettingsRow({ totpSecret: encrypt(TOTP_SECRET, strangerKey) })

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { warnings: string[] }
    expect(body.warnings).toContain(
      "TOTP could not be re-encrypted and was disabled. Re-enroll 2FA after login."
    )
    const settings = settingsWrite()
    expect(settings.totpSecret).toBeNull()
    expect(settings.totpBackupCodes).toBeNull()
  })

  it("PINS: failed backup codes are destroyed SILENTLY — no warning reaches the user", async () => {
    settingsRow = makeSettingsRow({ totpBackupCodes: encrypt(BACKUP_CODES, strangerKey) })

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { success: boolean; warnings?: string[] }

    // The TOTP secret survives, so totpDisabled stays false and the warning at
    // route.ts:323 never fires. The user's backup codes are wiped and the API
    // response says nothing at all about it.
    const settings = settingsWrite()
    expect(decrypt(settings.totpSecret as string, newKey)).toBe(TOTP_SECRET)
    expect(settings.totpBackupCodes).toBeNull()
    expect(body.warnings).toBeUndefined()
  })

  it("PINS: each settings secret that fails is nulled and warned about independently", async () => {
    settingsRow = makeSettingsRow({
      encryptedProxyPassword: encrypt("proxy-pw", strangerKey),
      encryptedBackupPassword: encrypt("backup-pw", strangerKey),
      encryptedPtpimgApiKey: encrypt("ptpimg-key", strangerKey),
      encryptedOeimgApiKey: encrypt("oeimg-key", strangerKey),
      encryptedImgbbApiKey: encrypt("imgbb-key", strangerKey),
    })

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { warnings: string[] }
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        "Proxy password could not be re-encrypted and was cleared. Re-enter it in settings.",
        "Backup password could not be re-encrypted and was cleared. Re-set it in backup settings.",
        "PTPImg API key could not be re-encrypted and was cleared. Re-enter it in settings.",
        "OEImg API key could not be re-encrypted and was cleared. Re-enter it in settings.",
        "ImgBB API key could not be re-encrypted and was cleared. Re-enter it in settings.",
      ])
    )

    const settings = settingsWrite()
    expect(settings.encryptedProxyPassword).toBeNull()
    expect(settings.encryptedBackupPassword).toBeNull()
    expect(settings.encryptedPtpimgApiKey).toBeNull()
    expect(settings.encryptedOeimgApiKey).toBeNull()
    expect(settings.encryptedImgbbApiKey).toBeNull()
  })
})

// ─── Blank credentials ────────────────────────────────────────────────────────

describe("POST /api/auth/change-password — blank credentials", () => {
  it("encrypt('') round-trips: 28 bytes in, empty string back out", () => {
    // crypto.ts: encrypt("") emits iv(12) + authTag(16) + 0 bytes of ciphertext.
    // The length guard admits exactly IV + TAG, so a deliberately blank secret is
    // a readable payload. Integrity is unaffected — the GCM tag covers a
    // zero-length ciphertext, which crypto.test.ts pins by tampering at 28 bytes.
    const ciphertext = encrypt("", oldKey)
    expect(Buffer.from(ciphertext, "base64")).toHaveLength(28)
    expect(decrypt(ciphertext, oldKey)).toBe("")
  })

  it("re-keys a client whose username and password are both blank", async () => {
    // Reachable today: PATCH /api/clients/[id] gates only on
    // `typeof body.username === "string"`, so `{ username: "" }` stores
    // encrypt("") in the NOT NULL column — the qBittorrent auth-bypass setup.
    clientRows[0] = {
      id: 10,
      name: "qbit",
      encryptedUsername: encrypt("", oldKey),
      encryptedPassword: encrypt("", oldKey),
    }

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { warnings?: string[] }
    expect(body.warnings).toBeUndefined()

    // Moved onto the new key, not skipped and left orphaned under the old one —
    // decrypting with the independently derived newKey is what proves it.
    const clientWrites = writesTo(downloadClients)
    expect(clientWrites).toHaveLength(1)
    expect(decrypt(clientWrites[0].values.encryptedUsername as string, newKey)).toBe("")
    expect(decrypt(clientWrites[0].values.encryptedPassword as string, newKey)).toBe("")
    expect(settingsWrite().passwordHash).toBe(NEW_HASH)
  })

  it("re-keys a tracker whose API token is blank", async () => {
    trackerRows = [{ id: 1, name: "Alpha", encryptedApiToken: encrypt("", oldKey) }]

    const response = await post()

    expect(response.status).toBe(200)
    const body = (await response.json()) as { warnings?: string[] }
    expect(body.warnings).toBeUndefined()

    const trackerWrites = writesTo(trackers)
    expect(trackerWrites).toHaveLength(1)
    expect(decrypt(trackerWrites[0].values.encryptedApiToken as string, newKey)).toBe("")
  })
})

// ─── Transaction failure ──────────────────────────────────────────────────────

describe("POST /api/auth/change-password — transaction failure", () => {
  it("returns 500 without ever attempting the password-hash write", async () => {
    failWritesFor = trackers

    const response = await post()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Password change failed. Your current password is unchanged.",
    })
    // The hash is written last, so an earlier failure means it was never
    // even attempted — the user is not locked out of their own secrets.
    expect(writesTo(appSettings)).toHaveLength(0)
  })

  it("does not end the session or stop the scheduler when the transaction fails", async () => {
    failWritesFor = appSettings

    const response = await post()

    expect(response.status).toBe(500)
    expect(clearSession).not.toHaveBeenCalled()
    expect(stopScheduler).not.toHaveBeenCalled()
    expect(clearSchedulerKey).not.toHaveBeenCalled()
  })

  it("PINS: the failed-attempt counter was already reset outside the transaction", async () => {
    failWritesFor = appSettings

    await post()

    // resetFailedAttempts fires at route.ts:69, before the transaction, and is
    // not rolled back with it — lockout state persists past a failed rotation.
    expect(resetFailedAttempts).toHaveBeenCalledWith(1)
  })
})

// ─── Stale session key ────────────────────────────────────────────────────────

describe("POST /api/auth/change-password — session key mismatch", () => {
  it("refuses when the session key does not match the current password", async () => {
    // The password check proves the caller knows the current password; it says
    // nothing about whether the session still holds the key the data was written
    // with. Those diverge whenever a session outlives a password change, which is
    // ordinary with a second signed-in device.
    //
    // This used to commit: every decrypt failed, which the handler read as every
    // row being corrupt, so it wrote the new hash, skipped every row and nulled
    // all seven settings secrets — leaving them under a key nobody holds.
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: strangerKey.toString("hex"),
    })

    const response = await post()

    expect(response.status).toBe(409)

    // Nothing is written at all — not the hash, not a single row, and no secret
    // is cleared. That is the whole point: a stale key must not be able to
    // destroy data it cannot read.
    expect(writesTo(appSettings)).toHaveLength(0)
    expect(writesTo(trackers)).toHaveLength(0)
    expect(writesTo(downloadClients)).toHaveLength(0)
    expect(writesTo(notificationTargets)).toHaveLength(0)
    expect(clearSession).not.toHaveBeenCalled()
  })
})
