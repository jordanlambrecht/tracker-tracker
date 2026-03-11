// src/lib/__tests__/security.test.ts
//
// Security invariant tests: auth enforcement, token leakage,
// input validation, setup protection, crypto integrity

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseTrackerId: vi.fn(),
    parseJsonBody: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-token"),
  decrypt: vi.fn().mockReturnValue("decrypted"),
  deriveKey: vi.fn().mockResolvedValue(Buffer.from("a".repeat(32))),
  generateSalt: vi.fn().mockReturnValue("a".repeat(64)),
}))

vi.mock("@/lib/scheduler", () => ({
  pollTracker: vi.fn(),
  stopScheduler: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  verifyPassword: vi.fn().mockResolvedValue(false),
  createSetupToken: vi.fn().mockResolvedValue("setup-token"),
  verifySetupToken: vi.fn().mockResolvedValue(null),
  createPendingToken: vi.fn().mockResolvedValue("pending-token"),
  verifyPendingToken: vi.fn().mockResolvedValue(null),
  clearSession: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/totp", () => ({
  generateTotpSecret: vi.fn().mockReturnValue({ secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/test" }),
  generateBackupCodes: vi.fn().mockReturnValue(["AAAA-1111"]),
  hashBackupCode: vi.fn().mockReturnValue({ hash: "abc", salt: "def", used: false }),
  verifyTotpCode: vi.fn().mockReturnValue(false),
  verifyAndConsumeBackupCode: vi.fn().mockReturnValue({ valid: false, updatedEntries: [] }),
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

vi.mock("@/lib/backup", () => ({
  generateBackupPayload: vi.fn(),
  encryptBackupPayload: vi.fn(),
  decryptBackupPayload: vi.fn(),
  validateBackupJson: vi.fn(),
  CURRENT_BACKUP_VERSION: 1,
}))

import { POST as ChangePasswordPOST } from "@/app/api/auth/change-password/route"
import { POST as TotpConfirmPOST } from "@/app/api/auth/totp/confirm/route"
import { POST as TotpDisablePOST } from "@/app/api/auth/totp/disable/route"
import { POST as TotpSetupPOST } from "@/app/api/auth/totp/setup/route"
import { DELETE as BackupDeleteDELETE } from "@/app/api/settings/backup/[id]/route"
import { POST as BackupExportPOST } from "@/app/api/settings/backup/export/route"
import { GET as BackupHistoryGET } from "@/app/api/settings/backup/history/route"
import { POST as BackupRestorePOST } from "@/app/api/settings/backup/restore/route"
import { POST as LockdownPOST } from "@/app/api/settings/lockdown/route"
import { POST as NukePOST } from "@/app/api/settings/nuke/route"
import { POST as ProxyTestPOST } from "@/app/api/settings/proxy-test/route"
import { GET as SettingsGET, PATCH as SettingsPATCH } from "@/app/api/settings/route"
// Route imports
import { POST as PollPOST } from "@/app/api/trackers/[id]/poll/route"
import { GET as RolesGET, POST as RolesPOST } from "@/app/api/trackers/[id]/roles/route"
import { DELETE, PATCH } from "@/app/api/trackers/[id]/route"
import { GET as SnapshotsGET } from "@/app/api/trackers/[id]/snapshots/route"
import { PATCH as ReorderPATCH } from "@/app/api/trackers/reorder/route"
import { GET, POST } from "@/app/api/trackers/route"
import { POST as TestPOST } from "@/app/api/trackers/test/route"
import { authenticate, parseJsonBody, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = "abcd1234".repeat(8)
const MOCK_PARAMS = Promise.resolve({ id: "1" })

function makeRequest(
  url: string,
  body?: Record<string, unknown>,
  method = "GET"
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function mockAuthFail() {
  ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  )
}

function mockAuthSuccess() {
  ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
    encryptionKey: VALID_KEY,
  })
}

// ---------------------------------------------------------------------------
// 1. Authentication required on all protected API routes
// ---------------------------------------------------------------------------

describe("Auth enforcement: every protected route returns 401 without valid session", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthFail()
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({})
  })

  it("GET /api/trackers returns 401", async () => {
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers", { name: "test" }, "POST")
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("PATCH /api/trackers/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1", { name: "test" }, "PATCH")
    const res = await PATCH(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("DELETE /api/trackers/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1", undefined, "DELETE")
    const res = await DELETE(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/[id]/poll returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const res = await PollPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/trackers/[id]/snapshots returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/snapshots")
    const res = await SnapshotsGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/trackers/[id]/roles returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/roles")
    const res = await RolesGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/[id]/roles returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/roles", { roleName: "test" }, "POST")
    const res = await RolesPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/test returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/test", { baseUrl: "https://example.com", apiToken: "tok" }, "POST")
    const res = await TestPOST(req)
    expect(res.status).toBe(401)
  })

  it("PATCH /api/trackers/reorder returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/reorder", { ids: [1, 2] }, "PATCH")
    const res = await ReorderPATCH(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/settings returns 401", async () => {
    const res = await SettingsGET()
    expect(res.status).toBe(401)
  })

  it("PATCH /api/settings returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings", { storeUsernames: false }, "PATCH")
    const res = await SettingsPATCH(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/totp/setup returns 401", async () => {
    const res = await TotpSetupPOST()
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/totp/confirm returns 401", async () => {
    const req = makeRequest("http://localhost/api/auth/totp/confirm", { setupToken: "t", code: "123456" }, "POST")
    const res = await TotpConfirmPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/totp/disable returns 401", async () => {
    const req = makeRequest("http://localhost/api/auth/totp/disable", { code: "123456" }, "POST")
    const res = await TotpDisablePOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/change-password returns 401", async () => {
    const req = makeRequest("http://localhost/api/auth/change-password", { currentPassword: "old", newPassword: "newpass123" }, "POST")
    const res = await ChangePasswordPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/lockdown returns 401", async () => {
    const res = await LockdownPOST()
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/nuke returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/nuke", { password: "test" }, "POST")
    const res = await NukePOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/proxy-test returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/proxy-test", { proxyType: "socks5", proxyHost: "127.0.0.1", proxyPort: 1080 }, "POST")
    const res = await ProxyTestPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/backup/export returns 401", async () => {
    const res = await BackupExportPOST()
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/backup/restore returns 401", async () => {
    const formData = new FormData()
    formData.append("file", new Blob(["{}"], { type: "application/json" }), "backup.json")
    formData.append("password", "test")
    const req = new Request("http://localhost/api/settings/backup/restore", {
      method: "POST",
      body: formData,
    })
    const res = await BackupRestorePOST(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/backup/history returns 401", async () => {
    const res = await BackupHistoryGET()
    expect(res.status).toBe(401)
  })

  it("DELETE /api/settings/backup/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/backup/1", undefined, "DELETE")
    const res = await BackupDeleteDELETE(req, { params: Promise.resolve({ id: "1" }) })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// 2. Encrypted tokens never leak in API responses
// ---------------------------------------------------------------------------

describe("Token leakage prevention", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthSuccess()
  })

  it("GET /api/trackers does not include encryptedApiToken in response", async () => {
    const tracker = {
      id: 1,
      name: "Aither",
      baseUrl: "https://aither.cc",
      platformType: "unit3d",
      isActive: true,
      lastPolledAt: null,
      lastError: null,
      color: "#00d4ff",
      qbtTag: null,
      sortOrder: 0,
      joinedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      apiPath: "/api/user",
      encryptedApiToken: "SUPER_SECRET_SHOULD_NOT_APPEAR",
    }

    const mockOrderBy = vi.fn().mockResolvedValue([tracker])
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    // settings query: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })
    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockSettingsFrom })
      .mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      })

    const res = await GET()
    const body = await res.json()
    const json = JSON.stringify(body)

    expect(json).not.toContain("SUPER_SECRET_SHOULD_NOT_APPEAR")
    expect(json).not.toContain("encryptedApiToken")
  })
})

// ---------------------------------------------------------------------------
// 3. Setup cannot be re-triggered
// ---------------------------------------------------------------------------

describe("Setup protection", () => {
  it("POST /api/auth/setup returns 400 when already configured", async () => {
    // We need to mock the db module differently for this test
    // since setup/route.ts uses db directly, not through api-helpers
    vi.doMock("@/lib/db", () => ({
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 1, passwordHash: "hash", encryptionSalt: "salt" }]),
          }),
        }),
      },
    }))

    const { POST: SetupPOST } = await import("@/app/api/auth/setup/route")
    const req = makeRequest(
      "http://localhost/api/auth/setup",
      { password: "mysecurepassword123" },
      "POST"
    )

    const res = await SetupPOST(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toContain("Already configured")
  })
})

// ---------------------------------------------------------------------------
// 4. Input validation on create
// ---------------------------------------------------------------------------

describe("Input validation: POST /api/trackers", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthSuccess()
  })

  it("rejects missing required fields", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects oversized name (>100 chars)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "a".repeat(101),
      baseUrl: "https://example.com",
      apiToken: "valid-token",
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects invalid URL format", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "not-a-url",
      apiToken: "valid-token",
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects invalid platform type", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "https://example.com",
      apiToken: "valid-token",
      platformType: "unknown-platform",
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects javascript: scheme in baseUrl (XSS prevention)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "javascript:alert(1)",
      apiToken: "valid-token",
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects data: scheme in baseUrl (SSRF prevention)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "data:text/html,<script>alert(1)</script>",
      apiToken: "valid-token",
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("rejects non-hex color value (injection prevention)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "https://example.com",
      apiToken: "valid-token",
      color: "red;background:blue",
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("accepts valid hex color", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "https://example.com",
      apiToken: "valid-token",
      color: "#00d4ff",
    })

    const mockReturning = vi.fn().mockResolvedValue([{ id: 1, name: "Test" }])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

})

// ---------------------------------------------------------------------------
// 5. Input validation: PATCH /api/settings trackerPollIntervalMinutes
// ---------------------------------------------------------------------------

describe("Input validation: PATCH /api/settings trackerPollIntervalMinutes", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthSuccess()

    // PATCH route fetches settings row before applying updates
    const mockSettingsRow = {
      id: 1,
      storeUsernames: true,
      username: null,
      sessionTimeoutMinutes: null,
      autoWipeThreshold: null,
      snapshotRetentionDays: null,
      trackerPollIntervalMinutes: 60,
      proxyEnabled: false,
      proxyType: "socks5",
      proxyHost: null,
      proxyPort: 1080,
      proxyUsername: null,
      encryptedProxyPassword: null,
      failedLoginAttempts: 0,
    }
    const mockLimit = vi.fn().mockResolvedValue([mockSettingsRow])
    const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom })
  })

  it("rejects non-integer trackerPollIntervalMinutes", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 30.5,
    })

    const req = makeRequest("http://localhost/api/settings", { trackerPollIntervalMinutes: 30.5 }, "PATCH")
    const res = await SettingsPATCH(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/poll interval/i)
  })

  it("rejects trackerPollIntervalMinutes below 15", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 5,
    })

    const req = makeRequest("http://localhost/api/settings", { trackerPollIntervalMinutes: 5 }, "PATCH")
    const res = await SettingsPATCH(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/poll interval/i)
  })

  it("rejects trackerPollIntervalMinutes above 1440", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      trackerPollIntervalMinutes: 9999,
    })

    const req = makeRequest("http://localhost/api/settings", { trackerPollIntervalMinutes: 9999 }, "PATCH")
    const res = await SettingsPATCH(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/poll interval/i)
  })
})

// ---------------------------------------------------------------------------
// 6. Crypto round-trip integrity
// ---------------------------------------------------------------------------

describe("Crypto integrity", () => {
  // Use real crypto functions (unmocked)
  let realEncrypt: typeof import("@/lib/crypto").encrypt
  let realDecrypt: typeof import("@/lib/crypto").decrypt
  let realGenerateSalt: typeof import("@/lib/crypto").generateSalt
  let realDeriveKey: typeof import("@/lib/crypto").deriveKey

  beforeEach(async () => {
    // Import real crypto module (bypassing mocks)
    const crypto = await vi.importActual<typeof import("@/lib/crypto")>("@/lib/crypto")
    realEncrypt = crypto.encrypt
    realDecrypt = crypto.decrypt
    realGenerateSalt = crypto.generateSalt
    realDeriveKey = crypto.deriveKey
  })

  it("encrypt then decrypt produces the original plaintext", async () => {
    const key = await realDeriveKey("test-password", realGenerateSalt())
    const plaintext = "my-secret-api-token-12345"
    const encrypted = realEncrypt(plaintext, key)
    const decrypted = realDecrypt(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it("decrypt rejects tampered ciphertext", async () => {
    const key = await realDeriveKey("test-password", realGenerateSalt())
    const encrypted = realEncrypt("my-secret", key)

    // Tamper with the ciphertext by flipping a byte
    const tampered = Buffer.from(encrypted, "base64")
    tampered[tampered.length - 1] ^= 0xff
    const tamperedStr = tampered.toString("base64")

    expect(() => realDecrypt(tamperedStr, key)).toThrow()
  })

  it("decrypt rejects wrong key", async () => {
    const key1 = await realDeriveKey("password-one", realGenerateSalt())
    const key2 = await realDeriveKey("password-two", realGenerateSalt())
    const encrypted = realEncrypt("my-secret", key1)

    expect(() => realDecrypt(encrypted, key2)).toThrow()
  })

  it("decrypt rejects truncated ciphertext", async () => {
    const key = await realDeriveKey("test-password", realGenerateSalt())
    const short = Buffer.from("too-short").toString("base64")
    expect(() => realDecrypt(short, key)).toThrow()
  })

  it("each encryption produces unique ciphertext (random IV)", async () => {
    const key = await realDeriveKey("test-password", realGenerateSalt())
    const plaintext = "same-input"
    const enc1 = realEncrypt(plaintext, key)
    const enc2 = realEncrypt(plaintext, key)
    expect(enc1).not.toBe(enc2)
  })
})

// ---------------------------------------------------------------------------
// 7. Encryption key zeroing on scheduler stop
// ---------------------------------------------------------------------------

describe("Encryption key zeroing", () => {
  it("stopScheduler zero-fills the encryption key buffer", async () => {
    const {
      startScheduler,
      stopScheduler,
      _getSchedulerKeyForTest,
    } = await vi.importActual<typeof import("@/lib/scheduler")>("@/lib/scheduler")

    const key = Buffer.from("a]1b2c3d4e5f6".repeat(3).slice(0, 32))
    const originalBytes = Buffer.from(key) // snapshot before zeroing

    startScheduler(key)

    // Key reference should be stored
    const storedKey = _getSchedulerKeyForTest()
    expect(storedKey).not.toBeNull()
    expect(storedKey).toBe(key) // same Buffer instance

    stopScheduler()

    // Buffer bytes should all be zero
    expect(key.every((byte) => byte === 0)).toBe(true)
    // And the reference should be cleared
    expect(_getSchedulerKeyForTest()).toBeNull()
    // Confirm it was non-zero before
    expect(originalBytes.some((byte) => byte !== 0)).toBe(true)
  })

  it("stopScheduler is safe to call when no scheduler is running", async () => {
    const {
      stopScheduler,
      _getSchedulerKeyForTest,
    } = await vi.importActual<typeof import("@/lib/scheduler")>("@/lib/scheduler")

    // Ensure clean state
    stopScheduler()
    expect(_getSchedulerKeyForTest()).toBeNull()
    // Should not throw
    expect(() => stopScheduler()).not.toThrow()
  })
})
