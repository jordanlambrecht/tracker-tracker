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
    parseRouteId: vi.fn(),
    parseJsonBody: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    selectDistinctOn: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted-token"),
  decrypt: vi.fn().mockReturnValue("decrypted"),
  deriveKey: vi.fn().mockResolvedValue(Buffer.from("a".repeat(32))),
  generateSalt: vi.fn().mockReturnValue("a".repeat(64)),
}))

vi.mock("@/lib/tracker-scheduler", () => ({
  pollTracker: vi.fn(),
  startTrackerPolling: vi.fn(),
  stopTrackerPolling: vi.fn(),
  isTrackerPollingRunning: vi.fn(() => false),
  fetchTrackerStats: vi.fn(),
}))

vi.mock("@/lib/scheduler", () => ({
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
  ensureSchedulerRunning: vi.fn(),
}))

vi.mock("@/lib/transit-papers/report-generator", () => ({
  generateReportPng: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
}))

vi.mock("@/lib/transit-papers/combined-seal", () => ({
  renderCombinedSeal: vi.fn().mockReturnValue({ pixels: new Uint8ClampedArray(4) }),
}))

vi.mock("@/lib/transit-papers/png", () => ({
  rgbaToPng: vi.fn().mockReturnValue(Buffer.from("fake-png")),
}))

vi.mock("@/lib/image-hosting", () => ({
  getImageHostAdapter: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ url: "https://example.com/image.png" }),
  }),
}))

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  verifyPassword: vi.fn().mockResolvedValue(false),
  createSetupToken: vi.fn().mockResolvedValue("setup-token"),
  verifySetupToken: vi.fn().mockResolvedValue(null),
  createPendingToken: vi.fn().mockResolvedValue("pending-token"),
  verifyPendingToken: vi.fn().mockResolvedValue(null),
  clearSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/totp", () => ({
  generateTotpSecret: vi.fn().mockReturnValue({
    secret: "JBSWY3DPEHPK3PXP",
    uri: "otpauth://totp/test",
  }),
  generateBackupCodes: vi.fn().mockReturnValue(["AAAA-1111"]),
  hashBackupCode: vi.fn().mockReturnValue({ hash: "abc", salt: "def", used: false }),
  verifyTotpCode: vi.fn().mockReturnValue(false),
  verifyAndConsumeBackupCode: vi.fn().mockReturnValue({ valid: false, updatedEntries: [] }),
  TOTP_CODE_RE: /^\d{6}$/,
  BACKUP_CODE_PATTERN: /^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/,
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
  dismissedAlerts: {},
  notificationTargets: {},
  notificationDeliveryState: {},
  clientUptimeBuckets: {},
}))

vi.mock("@/lib/backup", () => ({
  generateBackupPayload: vi.fn(),
  encryptBackupPayload: vi.fn(),
  decryptBackupPayload: vi.fn(),
  validateBackupJson: vi.fn(),
  CURRENT_BACKUP_VERSION: 1,
}))

vi.mock("@/lib/logger", () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock("@/lib/lockout", () => ({
  checkLockout: vi.fn().mockReturnValue(null),
  recordFailedAttempt: vi.fn(),
  resetFailedAttempts: vi.fn(),
}))

vi.mock("@/lib/nuke", () => ({
  scrubAndDeleteAll: vi.fn(),
}))

vi.mock("@/lib/download-client-scheduler", () => ({
  startClientScheduler: vi.fn(),
  stopClientScheduler: vi.fn(),
}))

vi.mock("@/lib/backup-scheduler", () => ({
  startBackupScheduler: vi.fn(),
  stopBackupScheduler: vi.fn(),
}))

vi.mock("@/lib/privacy", () => ({
  maskUsername: vi.fn((u: string) => u),
  isRedacted: vi.fn(() => false),
}))

vi.mock("@/lib/tunnel", () => ({
  VALID_PROXY_TYPES: new Set(["socks5", "http", "https"]),
  PROXY_HOST_PATTERN: /^[\w.\-:[\]]+$/,
  buildProxyAgentFromSettings: vi.fn().mockReturnValue(undefined),
  proxyFetch: vi.fn(),
}))

vi.mock("@/lib/download-clients", () => ({
  buildBaseUrl: vi.fn().mockReturnValue("http://localhost:8080"),
  getSession: vi.fn(),
  getTorrents: vi.fn().mockResolvedValue([]),
  getTransferInfo: vi.fn().mockResolvedValue({}),
  invalidateSession: vi.fn(),
  clearAllSessions: vi.fn(),
  login: vi.fn().mockResolvedValue("sid"),
  withSessionRetry: vi.fn().mockResolvedValue([]),
  aggregateByTag: vi.fn().mockReturnValue({}),
  getSpeedSnapshots: vi.fn().mockReturnValue([]),
  pushSpeedSnapshot: vi.fn(),
  clearSpeedCache: vi.fn(),
  mergeTorrentLists: vi.fn().mockReturnValue([]),
  aggregateCrossSeedTags: vi.fn().mockReturnValue([]),
  fetchAndMergeTorrents: vi.fn().mockResolvedValue({
    torrents: [],
    crossSeedTags: [],
    clientErrors: [],
    clientCount: 0,
    sessionExpired: false,
  }),
  stripSensitiveTorrentFields: vi.fn((t: Record<string, unknown>) => {
    const { tracker: _t, content_path: _cp, save_path: _sp, ...rest } = t
    return rest
  }),
  CLIENT_CONNECTION_COLUMNS: {},
  decryptClientCredentials: vi.fn().mockReturnValue({ username: "admin", password: "pass" }),
  parseCrossSeedTags: vi.fn((raw: string[] | null) => raw ?? []),
  slimTorrentForCache: vi.fn((t: Record<string, unknown>) => t),
  parseCachedTorrents: vi.fn().mockReturnValue([]),
  STORE_MAX_AGE_MS: 600000,
  isStoreFresh: vi.fn().mockReturnValue(false),
  getFilteredTorrents: vi.fn().mockReturnValue([]),
  VALID_CLIENT_TYPES: ["qbittorrent"],
}))

vi.mock("@/lib/privacy-db", () => ({
  createPrivacyMask: vi.fn(async () => (v: string | null | undefined) => v ?? null),
  createPrivacyMaskSync: vi.fn().mockReturnValue((v: string | null | undefined) => v ?? null),
}))

vi.mock("@/data/tracker-registry", () => ({
  findRegistryEntry: vi.fn(),
}))

vi.mock("@/lib/notifications/validate", () => ({
  validateNotificationConfig: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/notifications/decrypt", () => ({
  decryptNotificationConfig: vi
    .fn()
    .mockReturnValue({ webhookUrl: "https://discord.com/api/webhooks/123/abc" }),
}))

vi.mock("@/lib/notifications/deliver", () => ({
  deliverDiscordWebhook: vi.fn().mockResolvedValue({ success: true, status: "delivered" }),
}))

// ---------------------------------------------------------------------------
// Route imports
// ---------------------------------------------------------------------------

import {
  DELETE as AlertDismissedDELETE,
  GET as AlertDismissedGET,
  POST as AlertDismissedPOST,
} from "@/app/api/alerts/dismissed/route"
import { POST as ChangePasswordPOST } from "@/app/api/auth/change-password/route"
import { POST as LoginPOST } from "@/app/api/auth/login/route"
import { POST as LogoutPOST } from "@/app/api/auth/logout/route"
import { POST as TotpConfirmPOST } from "@/app/api/auth/totp/confirm/route"
import { POST as TotpDisablePOST } from "@/app/api/auth/totp/disable/route"
import { POST as TotpSetupPOST } from "@/app/api/auth/totp/setup/route"
import { POST as TotpVerifyPOST } from "@/app/api/auth/totp/verify/route"
import { GET as ChangelogGET } from "@/app/api/changelog/route"
import { DELETE as ClientDELETE, PATCH as ClientPATCH } from "@/app/api/clients/[id]/route"
import { GET as ClientSnapshotsGET } from "@/app/api/clients/[id]/snapshots/route"
import { GET as ClientSpeedsGET } from "@/app/api/clients/[id]/speeds/route"
import { POST as ClientTestPOST } from "@/app/api/clients/[id]/test/route"
import { GET as ClientTorrentsGET } from "@/app/api/clients/[id]/torrents/route"
import { GET as ClientsGET, POST as ClientsPOST } from "@/app/api/clients/route"
import { GET as FleetSnapshotsGET } from "@/app/api/fleet/snapshots/route"
import { GET as FleetTorrentsGET } from "@/app/api/fleet/torrents/route"
import {
  DELETE as NotificationDELETE,
  PATCH as NotificationPATCH,
} from "@/app/api/notifications/[id]/route"
import { POST as NotificationTestPOST } from "@/app/api/notifications/[id]/test/route"
import { GET as NotificationsGET, POST as NotificationsPOST } from "@/app/api/notifications/route"
import {
  DELETE as BackupDeleteDELETE,
  GET as BackupGetGET,
} from "@/app/api/settings/backup/[id]/route"
import { POST as BackupExportPOST } from "@/app/api/settings/backup/export/route"
import { GET as BackupHistoryGET } from "@/app/api/settings/backup/history/route"
import { POST as BackupRestorePOST } from "@/app/api/settings/backup/restore/route"
import { GET as DashboardGET, PUT as DashboardPUT } from "@/app/api/settings/dashboard/route"
import { GET as EventsGET } from "@/app/api/settings/events/route"
import { GET as ImageHostsGET } from "@/app/api/settings/image-hosts/route"
import { POST as LockdownPOST } from "@/app/api/settings/lockdown/route"
import { GET as LogsDownloadGET } from "@/app/api/settings/logs/download/route"
import { DELETE as LogsDELETE, GET as LogsGET } from "@/app/api/settings/logs/route"
import { POST as NukePOST } from "@/app/api/settings/nuke/route"
import { POST as ProxyTestPOST } from "@/app/api/settings/proxy-test/route"
import { GET as QuicklinksGET, PUT as QuicklinksPUT } from "@/app/api/settings/quicklinks/route"
import { POST as ResetStatsPOST } from "@/app/api/settings/reset-stats/route"
import { GET as SettingsGET, PATCH as SettingsPATCH } from "@/app/api/settings/route"
import {
  DELETE as MemberDELETE,
  PATCH as MemberPATCH,
} from "@/app/api/tag-groups/[id]/members/[memberId]/route"
import { GET as MembersGET, POST as MembersPOST } from "@/app/api/tag-groups/[id]/members/route"
import { DELETE as TagGroupDELETE, PATCH as TagGroupPATCH } from "@/app/api/tag-groups/[id]/route"
import { GET as TagGroupsGET, POST as TagGroupsPOST } from "@/app/api/tag-groups/route"
import { GET as TrackerAvatarGET } from "@/app/api/trackers/[id]/avatar/route"
import { POST as DebugPOST } from "@/app/api/trackers/[id]/debug/route"
import { POST as PollPOST } from "@/app/api/trackers/[id]/poll/route"
// Transit papers routes. Unimplemented for now.
// import { GET as ReportGET } from "@/app/api/trackers/[id]/report/route"
import { POST as ResumePOST } from "@/app/api/trackers/[id]/resume/route"
import { GET as RolesGET, POST as RolesPOST } from "@/app/api/trackers/[id]/roles/route"
import { DELETE, PATCH, GET as TrackerDetailGET } from "@/app/api/trackers/[id]/route"
// import { GET as SealGET } from "@/app/api/trackers/[id]/seal/route"
import { GET as SnapshotsGET } from "@/app/api/trackers/[id]/snapshots/route"
import { GET as TrackerTorrentsGET } from "@/app/api/trackers/[id]/torrents/route"
import { POST as PollAllPOST } from "@/app/api/trackers/poll-all/route"
import { PATCH as ReorderPATCH } from "@/app/api/trackers/reorder/route"
import { GET, POST } from "@/app/api/trackers/route"
import { POST as TestPOST } from "@/app/api/trackers/test-connection/route"
import { POST as UploadImagePOST } from "@/app/api/upload-image/route"

// ---------------------------------------------------------------------------
// Lib imports
// ---------------------------------------------------------------------------

import { authenticate, parseJsonBody, parseRouteId, parseTrackerId } from "@/lib/api-helpers"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = "abcd1234".repeat(8)
const MOCK_PARAMS = Promise.resolve({ id: "1" })

function makeRequest(url: string, body?: Record<string, unknown>, method = "GET"): Request {
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
    ;(parseRouteId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
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

  it("GET /api/trackers/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1")
    const res = await TrackerDetailGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/[id]/debug returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/debug", undefined, "POST")
    const res = await DebugPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/[id]/poll returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/poll", undefined, "POST")
    const res = await PollPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/[id]/resume returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/resume", undefined, "POST")
    const res = await ResumePOST(req, { params: MOCK_PARAMS })
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
    const req = makeRequest(
      "http://localhost/api/trackers/test",
      { baseUrl: "https://example.com", apiToken: "tok" },
      "POST"
    )
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
    const req = makeRequest(
      "http://localhost/api/auth/totp/confirm",
      { setupToken: "t", code: "123456" },
      "POST"
    )
    const res = await TotpConfirmPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/totp/disable returns 401", async () => {
    const req = makeRequest("http://localhost/api/auth/totp/disable", { code: "123456" }, "POST")
    const res = await TotpDisablePOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/change-password returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/auth/change-password",
      { currentPassword: "old", newPassword: "newpass123" },
      "POST"
    )
    const res = await ChangePasswordPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/lockdown returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/lockdown", { password: "test" }, "POST")
    const res = await LockdownPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/nuke returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/nuke", { password: "test" }, "POST")
    const res = await NukePOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/proxy-test returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/settings/proxy-test",
      { proxyType: "socks5", proxyHost: "127.0.0.1", proxyPort: 1080 },
      "POST"
    )
    const res = await ProxyTestPOST(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/backup/export returns 401", async () => {
    const req = new Request("http://localhost/api/settings/backup/export", {
      method: "POST",
      body: new FormData(), // Empty form data
    })
    const res = await BackupExportPOST(req)
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
    const res = await BackupDeleteDELETE(req, {
      params: Promise.resolve({ id: "1" }),
    })
    expect(res.status).toBe(401)
  })

  it("POST /api/auth/logout returns 401 when no session", async () => {
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const res = await LogoutPOST()
    expect(res.status).toBe(401)
  })

  it("GET /api/clients returns 401", async () => {
    const res = await ClientsGET()
    expect(res.status).toBe(401)
  })

  it("POST /api/clients returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients", { name: "test" }, "POST")
    const res = await ClientsPOST(req)
    expect(res.status).toBe(401)
  })

  it("PATCH /api/clients/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients/1", { name: "test" }, "PATCH")
    const res = await ClientPATCH(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("DELETE /api/clients/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients/1", undefined, "DELETE")
    const res = await ClientDELETE(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/clients/[id]/test returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients/1/test", undefined, "POST")
    const res = await ClientTestPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/clients/[id]/torrents returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients/1/torrents?tag=test")
    const res = await ClientTorrentsGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/clients/[id]/snapshots returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients/1/snapshots")
    const res = await ClientSnapshotsGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/clients/[id]/speeds returns 401", async () => {
    const req = makeRequest("http://localhost/api/clients/1/speeds")
    const res = await ClientSpeedsGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/tag-groups returns 401", async () => {
    const res = await TagGroupsGET()
    expect(res.status).toBe(401)
  })

  it("POST /api/tag-groups returns 401", async () => {
    const req = makeRequest("http://localhost/api/tag-groups", { name: "test" }, "POST")
    const res = await TagGroupsPOST(req)
    expect(res.status).toBe(401)
  })

  it("PATCH /api/tag-groups/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/tag-groups/1", { name: "test" }, "PATCH")
    const res = await TagGroupPATCH(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("DELETE /api/tag-groups/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/tag-groups/1", undefined, "DELETE")
    const res = await TagGroupDELETE(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/tag-groups/[id]/members returns 401", async () => {
    const req = makeRequest("http://localhost/api/tag-groups/1/members")
    const res = await MembersGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/tag-groups/[id]/members returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/tag-groups/1/members",
      { tag: "test", label: "Test" },
      "POST"
    )
    const res = await MembersPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("PATCH /api/tag-groups/[id]/members/[memberId] returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/tag-groups/1/members/1",
      { label: "test" },
      "PATCH"
    )
    const res = await MemberPATCH(req, {
      params: Promise.resolve({ id: "1", memberId: "1" }),
    })
    expect(res.status).toBe(401)
  })

  it("DELETE /api/tag-groups/[id]/members/[memberId] returns 401", async () => {
    const req = makeRequest("http://localhost/api/tag-groups/1/members/1", undefined, "DELETE")
    const res = await MemberDELETE(req, {
      params: Promise.resolve({ id: "1", memberId: "1" }),
    })
    expect(res.status).toBe(401)
  })

  it("GET /api/trackers/[id]/torrents returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/torrents")
    const res = await TrackerTorrentsGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("GET /api/trackers/[id]/avatar returns 401", async () => {
    const req = makeRequest("http://localhost/api/trackers/1/avatar")
    const res = await TrackerAvatarGET(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/trackers/poll-all returns 401", async () => {
    const res = await PollAllPOST()
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/dashboard returns 401", async () => {
    const res = await DashboardGET()
    expect(res.status).toBe(401)
  })

  it("PUT /api/settings/dashboard returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/settings/dashboard",
      { showHealthIndicators: true },
      "PUT"
    )
    const res = await DashboardPUT(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/quicklinks returns 401", async () => {
    const res = await QuicklinksGET()
    expect(res.status).toBe(401)
  })

  it("PUT /api/settings/quicklinks returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/quicklinks", { slugs: [] }, "PUT")
    const res = await QuicklinksPUT(req)
    expect(res.status).toBe(401)
  })

  it("POST /api/settings/reset-stats returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/settings/reset-stats",
      { password: "test" },
      "POST"
    )
    const res = await ResetStatsPOST(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/logs returns 401", async () => {
    const res = await LogsGET()
    expect(res.status).toBe(401)
  })

  it("GET /api/changelog returns 401", async () => {
    const res = await ChangelogGET()
    expect(res.status).toBe(401)
  })

  it("GET /api/fleet/snapshots returns 401", async () => {
    const req = makeRequest("http://localhost/api/fleet/snapshots")
    const res = await FleetSnapshotsGET(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/fleet/torrents returns 401", async () => {
    const res = await FleetTorrentsGET()
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/backup/[id] returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/backup/1")
    const res = await BackupGetGET(req, {
      params: Promise.resolve({ id: "1" }),
    })
    expect(res.status).toBe(401)
  })

  it("GET /api/alerts/dismissed returns 401", async () => {
    const res = await AlertDismissedGET()
    expect(res.status).toBe(401)
  })

  it("POST /api/alerts/dismissed returns 401", async () => {
    const req = makeRequest(
      "http://localhost/api/alerts/dismissed",
      { key: "test", type: "error" },
      "POST"
    )
    const res = await AlertDismissedPOST(req)
    expect(res.status).toBe(401)
  })

  it("DELETE /api/alerts/dismissed returns 401", async () => {
    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "DELETE")
    const res = await AlertDismissedDELETE(req)
    expect(res.status).toBe(401)
  })

  // Notification target routes
  it("GET /api/notifications returns 401 without session", async () => {
    const res = await NotificationsGET()
    expect(res.status).toBe(401)
  })

  it("POST /api/notifications returns 401 without session", async () => {
    const req = makeRequest(
      "http://localhost/api/notifications",
      {
        name: "test",
        type: "discord",
        config: { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
      },
      "POST"
    )
    const res = await NotificationsPOST(req)
    expect(res.status).toBe(401)
  })

  it("PATCH /api/notifications/1 returns 401 without session", async () => {
    const req = makeRequest("http://localhost/api/notifications/1", { name: "updated" }, "PATCH")
    const res = await NotificationPATCH(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("DELETE /api/notifications/1 returns 401 without session", async () => {
    const req = makeRequest("http://localhost/api/notifications/1", undefined, "DELETE")
    const res = await NotificationDELETE(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/notifications/1/test returns 401 without session", async () => {
    const req = makeRequest("http://localhost/api/notifications/1/test", undefined, "POST")
    const res = await NotificationTestPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(401)
  })

  it("POST /api/upload-image returns 401", async () => {
    const formData = new FormData()
    formData.append("host", "ptpimg")
    formData.append("image", new Blob(["fake"], { type: "image/png" }), "test.png")
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      body: formData,
    })
    const res = await UploadImagePOST(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/image-hosts returns 401", async () => {
    const res = await ImageHostsGET()
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/events returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/events")
    const res = await EventsGET(req)
    expect(res.status).toBe(401)
  })

  it("DELETE /api/settings/logs returns 401", async () => {
    const req = makeRequest("http://localhost/api/settings/logs", { password: "test" }, "DELETE")
    const res = await LogsDELETE(req)
    expect(res.status).toBe(401)
  })

  it("GET /api/settings/logs/download returns 401", async () => {
    const res = await LogsDownloadGET()
    expect(res.status).toBe(401)
  })

  // Transit papers routes — stashed, uncomment when restored
  // it("GET /api/trackers/[id]/report returns 401", async () => {
  //   const req = makeRequest("http://localhost/api/trackers/1/report")
  //   const res = await ReportGET(req, { params: MOCK_PARAMS })
  //   expect(res.status).toBe(401)
  // })

  // it("GET /api/trackers/[id]/seal returns 401", async () => {
  //   const req = makeRequest("http://localhost/api/trackers/1/seal")
  //   const res = await SealGET(req, { params: MOCK_PARAMS })
  //   expect(res.status).toBe(401)
  // })
})

// ---------------------------------------------------------------------------
// 2. Public endpoint documentation
// ---------------------------------------------------------------------------

// NOTE: POST /api/verify-report and /api/verify-report/fetch-image are
// intentionally public endpoints. They use in-memory rate limiting instead of
// authentication. Moderators verify reports without needing an account.
// Do NOT add authenticate() to these routes.

// ---------------------------------------------------------------------------
// 3. Encrypted tokens never leak in API responses
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

    // Call 1: db.select().from(trackers).orderBy(trackers.createdAt)
    const mockOrderBy = vi.fn().mockResolvedValue([tracker])
    const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy })
    // Call 2: db.select({storeUsernames}).from(appSettings).limit(1)
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFrom })
      .mockReturnValueOnce({ from: mockSettingsFrom })
    // DISTINCT ON query via db.selectDistinctOn
    ;(db.selectDistinctOn as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    })

    const res = await GET()
    const body = await res.json()
    const json = JSON.stringify(body)

    expect(json).not.toContain("SUPER_SECRET_SHOULD_NOT_APPEAR")
    expect(json).not.toContain("encryptedApiToken")
  })

  it("GET /api/notifications never includes encryptedConfig in responses", async () => {
    // Mock returns the shape produced by notificationTargetColumns projection.
    // encryptedConfig is never selected; hasConfig is a SQL boolean computed at query level.
    const target = {
      id: 1,
      name: "My Discord",
      type: "discord",
      enabled: true,
      hasConfig: true,
      notifyRatioDrop: true,
      notifyHitAndRun: false,
      notifyTrackerDown: true,
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
    }

    const mockFrom = vi.fn().mockResolvedValue([target])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const res = await NotificationsGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const json = JSON.stringify(body)

    expect(json).not.toContain("encryptedConfig")
    expect(body[0]).toHaveProperty("hasConfig", true)
    expect(body[0]).toHaveProperty("name", "My Discord")
    expect(body[0]).toHaveProperty("notifyDownloadDisabled", false)
  })

  it("GET /api/trackers/[id] does not include encryptedApiToken or apiPath in response", async () => {
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    // DB row with secrets present — the route's .select() projection must strip them
    const trackerRow = {
      id: 1,
      name: "TestTracker",
      baseUrl: "https://test.example.com",
      platformType: "unit3d",
      isActive: true,
      lastPolledAt: null,
      lastError: null,
      color: "#00d4ff",
      qbtTag: null,
      useProxy: false,
      countCrossSeedUnsatisfied: false,
      isFavorite: false,
      sortOrder: 0,
      joinedAt: null,
      lastAccessAt: null,
      remoteUserId: null,
      platformMeta: null,
      createdAt: new Date(),
      // Secrets that MUST NOT appear in the response
      encryptedApiToken: "SECRET_API_TOKEN_CIPHERTEXT",
      apiPath: "/api/user",
    }

    // Call 1: tracker detail with explicit column allowlist
    const mockTrackerWhere = vi
      .fn()
      .mockReturnValue({ limit: vi.fn().mockResolvedValue([trackerRow]) })
    const mockTrackerFrom = vi.fn().mockReturnValue({ where: mockTrackerWhere })

    // Call 2: latest snapshot
    const mockSnapshotWhere = vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
    })
    const mockSnapshotFrom = vi.fn().mockReturnValue({ where: mockSnapshotWhere })

    // Call 3: appSettings for privacy
    const mockSettingsLimit = vi.fn().mockResolvedValue([{ storeUsernames: true }])
    const mockSettingsFrom = vi.fn().mockReturnValue({ limit: mockSettingsLimit })

    ;(db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockTrackerFrom })
      .mockReturnValueOnce({ from: mockSnapshotFrom })
      .mockReturnValueOnce({ from: mockSettingsFrom })

    const req = makeRequest("http://localhost/api/trackers/1")
    const res = await TrackerDetailGET(req, { params: MOCK_PARAMS })
    const body = await res.json()
    const json = JSON.stringify(body)

    expect(res.status).toBe(200)
    expect(json).not.toContain("SECRET_API_TOKEN_CIPHERTEXT")
    expect(json).not.toContain("encryptedApiToken")
    expect(json).not.toContain("apiPath")
    // Verify slot-critical fields ARE present
    expect(body).toHaveProperty("lastAccessAt")
    expect(body).toHaveProperty("platformMeta")
    expect(body).toHaveProperty("platformType")
  })

  it("GET /api/settings/image-hosts returns booleans, not ciphertext", async () => {
    // Mock returns the shape produced by settingsColumns projection.
    // The encrypted columns are selected under aliased names (hasPtpimgKey etc.)
    // and coerced to booleans by the serializer. Ciphertext enters server memory
    // but never reaches the response.
    const mockLimit = vi.fn().mockResolvedValue([
      {
        hasPtpimgKey: "ENCRYPTED_PTPIMG_KEY_CIPHERTEXT",
        hasOeimgKey: "ENCRYPTED_OEIMG_KEY_CIPHERTEXT",
        hasImgbbKey: null,
      },
    ])
    const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const res = await ImageHostsGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const json = JSON.stringify(body)

    // Ciphertext must never appear in the response
    expect(json).not.toContain("ENCRYPTED_PTPIMG_KEY_CIPHERTEXT")
    expect(json).not.toContain("ENCRYPTED_OEIMG_KEY_CIPHERTEXT")
    expect(json).not.toContain("encryptedPtpimgApiKey")
    expect(json).not.toContain("encryptedOeimgApiKey")
    expect(json).not.toContain("encryptedImgbbApiKey")

    // Response must only contain boolean presence flags
    expect(body).toHaveProperty("ptpimg", true)
    expect(body).toHaveProperty("onlyimage", true)
    expect(body).toHaveProperty("imgbb", false)
  })

  it("GET /api/settings does not include encrypted image hosting keys in response", async () => {
    // Mock fetchSettings — GET /api/settings calls fetchSettings() which uses
    // settingsColumns (a projected select). The serializer converts ciphertext
    // column values to booleans via !!value before they leave the server.
    const mockLimit = vi.fn().mockResolvedValue([
      {
        storeUsernames: true,
        username: null,
        sessionTimeoutMinutes: null,
        lockoutEnabled: false,
        lockoutThreshold: 5,
        lockoutDurationMinutes: 30,
        snapshotRetentionDays: null,
        trackerPollIntervalMinutes: 60,
        proxyEnabled: false,
        proxyType: null,
        proxyHost: null,
        proxyPort: null,
        proxyUsername: null,
        hasProxyPassword: null,
        // These are the encrypted key columns projected as boolean aliases
        hasPtpimgKey: "ENCRYPTED_PTPIMG_KEY_SHOULD_NOT_APPEAR",
        hasOeimgKey: "ENCRYPTED_OEIMG_KEY_SHOULD_NOT_APPEAR",
        hasImgbbKey: null,
        qbitmanageEnabled: false,
        qbitmanageTags: null,
        backupScheduleEnabled: false,
        backupScheduleFrequency: "daily",
        backupRetentionCount: 7,
        backupEncryptionEnabled: false,
        hasBackupPassword: null,
        backupStoragePath: null,
      },
    ])
    const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })

    const res = await SettingsGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const json = JSON.stringify(body)

    // Ciphertext must never appear in the response
    expect(json).not.toContain("ENCRYPTED_PTPIMG_KEY_SHOULD_NOT_APPEAR")
    expect(json).not.toContain("ENCRYPTED_OEIMG_KEY_SHOULD_NOT_APPEAR")
    expect(json).not.toContain("encryptedPtpimgApiKey")
    expect(json).not.toContain("encryptedOeimgApiKey")
    expect(json).not.toContain("encryptedImgbbApiKey")

    // serializeSettingsResponse must coerce to boolean
    expect(body).toHaveProperty("hasPtpimgKey", true)
    expect(body).toHaveProperty("hasOeimgKey", true)
    expect(body).toHaveProperty("hasImgbbKey", false)
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
            limit: vi
              .fn()
              .mockResolvedValue([{ id: 1, passwordHash: "hash", encryptionSalt: "salt" }]),
          }),
        }),
        transaction: vi.fn(),
      },
    }))
    vi.doMock("@/lib/api-helpers", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
      return {
        ...actual,
        parseJsonBody: vi.fn().mockResolvedValue({
          password: "mysecurepassword123",
          username: "admin",
        }),
      }
    })

    const { POST: SetupPOST } = await import("@/app/api/auth/setup/route")
    const req = makeRequest(
      "http://localhost/api/auth/setup",
      { password: "mysecurepassword123", username: "admin" },
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

  // "rejects missing required fields", "rejects oversized name", and
  // "rejects invalid URL format" are covered in tracker-routes.test.ts

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
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: mockValues,
    })

    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

// ---------------------------------------------------------------------------
// 5. Input validation: additional field constraints
// ---------------------------------------------------------------------------

describe("Input validation: additional field constraints", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthSuccess()
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  })

  // "rejects oversized API token" is covered in tracker-routes.test.ts

  it("rejects oversized qbtTag (>100 chars)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: "Test",
      baseUrl: "https://example.com",
      apiToken: "valid-token",
      qbtTag: "a".repeat(101),
    })
    const req = makeRequest("http://localhost/api/trackers", {}, "POST")
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/tag/i)
  })

  it("rejects role name over 255 chars", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      roleName: "a".repeat(256),
    })
    const req = makeRequest("http://localhost/api/trackers/1/roles", {}, "POST")
    const res = await RolesPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/role name/i)
  })

  it("rejects notes over 2000 chars", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      roleName: "Member",
      notes: "a".repeat(2001),
    })
    const req = makeRequest("http://localhost/api/trackers/1/roles", {}, "POST")
    const res = await RolesPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/notes/i)
  })

  it("rejects invalid achievedAt format", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      roleName: "Member",
      achievedAt: "not-a-date",
    })
    const req = makeRequest("http://localhost/api/trackers/1/roles", {}, "POST")
    const res = await RolesPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/date/i)
  })

  it("accepts valid achievedAt date", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      roleName: "Member",
      achievedAt: "2024-01-15",
    })

    const mockReturning = vi.fn().mockResolvedValue([
      {
        id: 1,
        trackerId: 1,
        roleName: "Member",
        achievedAt: new Date("2024-01-15"),
        notes: null,
      },
    ])
    const mockValues = vi.fn().mockReturnValue({ returning: mockReturning })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: mockValues,
    })

    const req = makeRequest("http://localhost/api/trackers/1/roles", {}, "POST")
    const res = await RolesPOST(req, { params: MOCK_PARAMS })
    expect(res.status).toBe(201)
  })

  it("rejects non-integer tracker ID", async () => {
    ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
    )
    const req = makeRequest("http://localhost/api/trackers/abc/roles", {}, "POST")
    const res = await RolesPOST(req, {
      params: Promise.resolve({ id: "abc" }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/tracker ID/i)
  })
})

// ---------------------------------------------------------------------------
// 6. Crypto round-trip integrity — covered by src/lib/crypto.test.ts
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 7. Encryption key zeroing on scheduler stop
// ---------------------------------------------------------------------------

describe("Encryption key zeroing", () => {
  it("stopScheduler zero-fills the encryption key buffer", async () => {
    const { startTrackerPolling, stopTrackerPolling, _getSchedulerKeyForTest } =
      await vi.importActual<typeof import("@/lib/tracker-scheduler")>("@/lib/tracker-scheduler")

    const key = Buffer.from("a]1b2c3d4e5f6".repeat(3).slice(0, 32))
    const originalBytes = Buffer.from(key) // snapshot before zeroing

    startTrackerPolling(key)

    // Key reference should be stored
    const storedKey = _getSchedulerKeyForTest()
    expect(storedKey).not.toBeNull()
    expect(storedKey).toBe(key) // same Buffer instance

    stopTrackerPolling()

    // Buffer bytes should all be zero
    expect(key.every((byte) => byte === 0)).toBe(true)
    // And the reference should be cleared
    expect(_getSchedulerKeyForTest()).toBeNull()
    // Confirm it was non-zero before
    expect(originalBytes.some((byte) => byte !== 0)).toBe(true)
  })

  it("stopScheduler is safe to call when no scheduler is running", async () => {
    const { stopTrackerPolling, _getSchedulerKeyForTest } =
      await vi.importActual<typeof import("@/lib/tracker-scheduler")>("@/lib/tracker-scheduler")

    // Ensure clean state
    stopTrackerPolling()
    expect(_getSchedulerKeyForTest()).toBeNull()
    // Should not throw
    expect(() => stopTrackerPolling()).not.toThrow()
  })
})

describe("Backup restore authenticated flows", () => {
  const VALID_BACKUP = {
    manifest: {
      version: 1,
      appVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      encrypted: false,
      counts: {
        trackers: 1,
        trackerSnapshots: 0,
        trackerRoles: 0,
        downloadClients: 0,
        tagGroups: 0,
        tagGroupMembers: 0,
        clientSnapshots: 0,
      },
    },
    settings: {
      encryptionSalt: "a".repeat(64),
      backupScheduleFrequency: "daily",
      backupRetentionCount: 7,
    },
    trackers: [
      {
        id: 1,
        name: "Test Tracker",
        baseUrl: "https://example.com",
        apiPath: "/api",
        platformType: "unit3d",
        encryptedApiToken: "encrypted_token",
        color: "#ff0000",
      },
    ],
    trackerSnapshots: [],
    trackerRoles: [],
    downloadClients: [],
    tagGroups: [],
    tagGroupMembers: [],
    clientSnapshots: [],
  }

  // Helper to create a mock request with FormData
  function createRestoreRequest(
    fileContent: string,
    masterPassword: string,
    backupPassword?: string,
    fileSize?: number
  ): Request {
    const blob = fileSize
      ? new Blob(["x".repeat(fileSize)], { type: "application/json" })
      : new Blob([fileContent], { type: "application/json" })

    const formData = new FormData()
    formData.append("file", blob, "backup.json")
    formData.append("masterPassword", masterPassword)
    if (backupPassword !== undefined) {
      formData.append("backupPassword", backupPassword)
    }

    const req = new Request("http://localhost/api/settings/backup/restore", {
      method: "POST",
    })

    // Mock formData() method to return our FormData since Node.js Request doesn't support it natively
    req.formData = vi.fn().mockResolvedValue(formData)

    return req
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("POST /api/settings/backup/restore with wrong password returns 401", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { log } = await import("@/lib/logger")

    // Mock authenticate to return valid session
    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    // Mock db to return valid settings
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    // Mock verifyPassword to return false (wrong master password)
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const req = createRestoreRequest(JSON.stringify(VALID_BACKUP), "wrong_master_password")
    const res = await POST(req)

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe("Invalid master password")
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "restore_unauthorized",
        reason: "invalid_master_password",
        encrypted: false,
        fileNameHash: expect.any(String),
      }),
      "Restore attempt with invalid master password"
    )
    expect(log.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ fileName: expect.any(String) }),
      expect.any(String)
    )
  })

  it("POST /api/settings/backup/restore records failed attempt on wrong password", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { recordFailedAttempt } = await import("@/lib/lockout")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
            lockedUntil: null,
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(verifyPassword).mockResolvedValue(false)

    const req = createRestoreRequest(JSON.stringify(VALID_BACKUP), "wrong_master_password")
    const res = await POST(req)

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: "Invalid master password" })
    expect(recordFailedAttempt).toHaveBeenCalledWith(1, expect.any(Object))
  })

  it("POST /api/settings/backup/restore with invalid JSON returns 400", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(verifyPassword).mockResolvedValue(true)

    const req = createRestoreRequest("invalid json content", "correct_password")
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Invalid JSON")
  })

  it("POST /api/settings/backup/restore with invalid backup structure returns 400", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { validateBackupJson } = await import("@/lib/backup")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(verifyPassword).mockResolvedValue(true)

    // Mock validateBackupJson to throw for invalid backup
    vi.mocked(validateBackupJson).mockImplementation(() => {
      throw new Error("Unsupported backup version")
    })

    const invalidBackup = {
      manifest: {
        version: 999, // Invalid version
        createdAt: "invalid-date",
      },
      settings: {},
      trackers: [],
    }

    const req = createRestoreRequest(JSON.stringify(invalidBackup), "correct_password")
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Invalid or corrupted backup file")
  })

  it("POST /api/settings/backup/restore with no password returns 400", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    const req = createRestoreRequest(JSON.stringify(VALID_BACKUP), "")
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Master password is required to restore backups")
  })

  it("POST /api/settings/backup/restore with file too large returns 400", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    // Create a file larger than 50MB
    const req = createRestoreRequest("", "correct_password", undefined, 51 * 1024 * 1024)
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("exceeds maximum size")
  })
})

// ---------------------------------------------------------------------------
// 9. Backup/restore round-trip for new notify* columns
// ---------------------------------------------------------------------------

describe("Backup restore: new notify* column round-trip", () => {
  const BASE_BACKUP = {
    manifest: {
      version: 1,
      appVersion: "2.1.0",
      createdAt: new Date().toISOString(),
      encrypted: false,
      counts: {
        trackers: 0,
        trackerSnapshots: 0,
        trackerRoles: 0,
        downloadClients: 0,
        tagGroups: 0,
        tagGroupMembers: 0,
        clientSnapshots: 0,
      },
    },
    settings: {
      encryptionSalt: "a".repeat(64),
    },
    trackers: [],
    trackerSnapshots: [],
    trackerRoles: [],
    downloadClients: [],
    tagGroups: [],
    tagGroupMembers: [],
    clientSnapshots: [],
  }

  function createRestoreRequest(fileContent: string, masterPassword: string): Request {
    const blob = new Blob([fileContent], { type: "application/json" })
    const formData = new FormData()
    formData.append("file", blob, "backup.json")
    formData.append("masterPassword", masterPassword)

    const req = new Request("http://localhost/api/settings/backup/restore", {
      method: "POST",
    })
    req.formData = vi.fn().mockResolvedValue(formData)
    return req
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("preserves new notify* columns during backup/restore", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { validateBackupJson } = await import("@/lib/backup")
    const { deriveKey } = await import("@/lib/crypto")

    vi.mocked(authenticate).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    // deriveKey is cleared by clearAllMocks() — restore it so key derivation succeeds
    vi.mocked(deriveKey).mockResolvedValue(Buffer.from("a".repeat(32)))

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(validateBackupJson).mockImplementation(() => undefined)

    // Backup payload includes a notificationTarget with all 5 new notify* flags set to true
    const backupWithNotifyFlags = {
      ...BASE_BACKUP,
      notificationTargets: [
        {
          id: 1,
          name: "My Discord",
          type: "discord",
          enabled: true,
          encryptedConfig: "encrypted_config_value",
          notifyRatioDrop: false,
          notifyHitAndRun: false,
          notifyTrackerDown: false,
          notifyBufferMilestone: false,
          notifyWarned: true,
          notifyRatioDanger: true,
          notifyZeroSeeding: true,
          notifyRankChange: true,
          notifyAnniversary: true,
          thresholds: null,
          includeTrackerName: true,
          scope: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }

    // Capture what gets inserted via the transaction's tx.insert().values() calls
    const insertedValues: Record<string, unknown>[] = []

    // Use plain functions for the insert chain to capture inserts into insertedValues
    const txMock = {
      select: () => ({ from: () => ({ limit: () => Promise.resolve([]) }) }),
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          insertedValues.push(vals)
          return Promise.resolve()
        },
        onConflictDoNothing: () => Promise.resolve(),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
      delete: () => Promise.resolve(undefined),
      execute: () => Promise.resolve([]),
    }

    // Mock db.transaction to invoke the callback with the tx mock
    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => await fn(txMock)
    )

    const req = createRestoreRequest(JSON.stringify(backupWithNotifyFlags), "correct_password")
    await POST(req)

    // Find the insert call for notificationTargets (it should include the 5 new flags)
    const ntInsert = insertedValues.find(
      (v) => typeof v === "object" && v !== null && "notifyWarned" in v
    )

    // The insert must have preserved all 5 new notify* columns as true
    expect(ntInsert).toBeDefined()
    expect(ntInsert?.notifyWarned).toBe(true)
    expect(ntInsert?.notifyRatioDanger).toBe(true)
    expect(ntInsert?.notifyZeroSeeding).toBe(true)
    expect(ntInsert?.notifyRankChange).toBe(true)
    expect(ntInsert?.notifyAnniversary).toBe(true)
  })

  it("defaults new notify* columns to false when restoring older backup without them", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { validateBackupJson } = await import("@/lib/backup")
    const { deriveKey } = await import("@/lib/crypto")

    vi.mocked(authenticate).mockResolvedValue({ encryptionKey: "a".repeat(64) })
    vi.mocked(deriveKey).mockResolvedValue(Buffer.from("a".repeat(32)))

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(validateBackupJson).mockImplementation(() => undefined)

    // Older backup: notificationTarget missing all 5 new notify* fields
    const olderBackup = {
      ...BASE_BACKUP,
      notificationTargets: [
        {
          id: 1,
          name: "Legacy Discord",
          type: "discord",
          enabled: true,
          encryptedConfig: "encrypted_config_value",
          notifyRatioDrop: true,
          notifyHitAndRun: false,
          notifyTrackerDown: true,
          notifyBufferMilestone: false,
          // notifyWarned, notifyRatioDanger, notifyZeroSeeding, notifyRankChange, notifyAnniversary — absent
          thresholds: null,
          includeTrackerName: true,
          scope: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }

    const insertedValues: Record<string, unknown>[] = []

    const txMock2 = {
      select: () => ({ from: () => ({ limit: () => Promise.resolve([]) }) }),
      insert: () => ({
        values: (vals: Record<string, unknown>) => {
          insertedValues.push(vals)
          return Promise.resolve()
        },
        onConflictDoNothing: () => Promise.resolve(),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(undefined),
        }),
      }),
      delete: () => Promise.resolve(undefined),
      execute: () => Promise.resolve([]),
    }

    ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => await fn(txMock2)
    )

    const req = createRestoreRequest(JSON.stringify(olderBackup), "correct_password")
    await POST(req)

    const ntInsert = insertedValues.find(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        "name" in v &&
        (v as Record<string, unknown>).name === "Legacy Discord"
    )

    // All 5 new columns must default to false when absent from the backup payload
    expect(ntInsert).toBeDefined()
    expect(ntInsert?.notifyWarned).toBe(false)
    expect(ntInsert?.notifyRatioDanger).toBe(false)
    expect(ntInsert?.notifyZeroSeeding).toBe(false)
    expect(ntInsert?.notifyRankChange).toBe(false)
    expect(ntInsert?.notifyAnniversary).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 10. Login route: crypto failure produces 500
// ---------------------------------------------------------------------------

describe("Login route crypto failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 500 with safe message when verifyPassword throws (corrupted hash)", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi
          .fn()
          .mockResolvedValue([
            { id: 1, passwordHash: "corrupted-not-argon2", encryptionSalt: "a".repeat(64) },
          ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(parseJsonBody).mockResolvedValue({ password: "test-password-123" })

    const { verifyPassword } = await import("@/lib/auth")
    vi.mocked(verifyPassword).mockRejectedValue(
      new Error("pchstr must contain a $ as the first character")
    )

    const req = new Request("http://localhost/api/auth/login", { method: "POST" })
    const res = await LoginPOST(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Login system error. Contact administrator.")
    expect(JSON.stringify(data)).not.toContain("pchstr")
    expect(JSON.stringify(data)).not.toContain("argon2")
  })
})

// ---------------------------------------------------------------------------
// 11. TOTP verify: decrypt failure produces 500
// ---------------------------------------------------------------------------

describe("TOTP verify decrypt failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 500 with safe message when TOTP secret decrypt fails", async () => {
    const { verifyPendingToken } = await import("@/lib/auth")
    const { decrypt } = await import("@/lib/crypto")

    vi.mocked(parseJsonBody).mockResolvedValue({
      pendingToken: "valid-pending-token",
      code: "123456",
    })

    vi.mocked(verifyPendingToken).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            totpSecret: "corrupt-ciphertext",
            passwordHash: "hash",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(decrypt).mockImplementation(() => {
      throw new Error("Unsupported state or unable to authenticate data")
    })

    const req = new Request("http://localhost/api/auth/totp/verify", { method: "POST" })
    const res = await TotpVerifyPOST(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Failed to decrypt TOTP secret")
    expect(JSON.stringify(data)).not.toContain("authenticate data")
  })
})

// ---------------------------------------------------------------------------
// 12. Backup export: decrypt failure returns 500, not unencrypted backup
// ---------------------------------------------------------------------------

describe("Backup export decrypt failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 500 when backup password decrypt fails (not unencrypted backup)", async () => {
    const { decrypt } = await import("@/lib/crypto")
    const { generateBackupPayload } = await import("@/lib/backup")

    vi.mocked(authenticate).mockResolvedValue({ encryptionKey: "a".repeat(64) })

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            backupEncryptionEnabled: true,
            encryptedBackupPassword: "corrupt-ciphertext",
            backupStoragePath: "/data/backups",
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    vi.mocked(generateBackupPayload).mockResolvedValue({
      manifest: { version: 1 },
      settings: {},
      trackers: [],
      trackerSnapshots: [],
      trackerRoles: [],
      downloadClients: [],
      tagGroups: [],
      tagGroupMembers: [],
      clientSnapshots: [],
    } as unknown as Awaited<ReturnType<typeof generateBackupPayload>>)

    vi.mocked(decrypt).mockImplementation(() => {
      throw new Error("Invalid ciphertext: too short")
    })

    const formData = new FormData()
    const req = new Request("http://localhost/api/settings/backup/export", { method: "POST" })
    req.formData = vi.fn().mockResolvedValue(formData)

    const res = await BackupExportPOST(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain("Failed to decrypt backup password")
    expect(JSON.stringify(data)).not.toContain("ciphertext")
  })
})

// ---------------------------------------------------------------------------
// 13. Backup restore: security hardening
// ---------------------------------------------------------------------------

describe("Backup restore security hardening", () => {
  const VALID_BACKUP = {
    manifest: {
      version: 1,
      appVersion: "1.0.0",
      createdAt: new Date().toISOString(),
      encrypted: false,
      counts: {
        trackers: 0,
        trackerSnapshots: 0,
        trackerRoles: 0,
        downloadClients: 0,
        tagGroups: 0,
        tagGroupMembers: 0,
        clientSnapshots: 0,
      },
    },
    settings: {
      encryptionSalt: "a".repeat(64),
      backupScheduleFrequency: "daily",
      backupRetentionCount: 7,
    },
    trackers: [],
    trackerSnapshots: [],
    trackerRoles: [],
    downloadClients: [],
    tagGroups: [],
    tagGroupMembers: [],
    clientSnapshots: [],
  }

  function createRestoreRequest(fileContent: string, masterPassword: string): Request {
    const blob = new Blob([fileContent], { type: "application/json" })
    const formData = new FormData()
    formData.append("file", blob, "backup.json")
    formData.append("masterPassword", masterPassword)

    const req = new Request("http://localhost/api/settings/backup/restore", {
      method: "POST",
    })
    req.formData = vi.fn().mockResolvedValue(formData)
    return req
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects master password shorter than PASSWORD_MIN with 400", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })

    const req = createRestoreRequest(JSON.stringify(VALID_BACKUP), "short")
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Master password is required to restore backups")
    // Must reject before any DB interaction
    expect(db.select).not.toHaveBeenCalled()
  })

  it("returns 500 when key derivation fails instead of proceeding", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { deriveKey } = await import("@/lib/crypto")
    const { validateBackupJson } = await import("@/lib/backup")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(validateBackupJson).mockImplementation(() => undefined)

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    // deriveKey throws (simulating scrypt OOM or crypto failure)
    vi.mocked(deriveKey).mockRejectedValue(new Error("scrypt: memory allocation failed"))

    const req = createRestoreRequest(JSON.stringify(VALID_BACKUP), "a]3$kF9!mZq2vR7x")
    const res = await POST(req)

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain("derive encryption keys")
    // Must NOT start the destructive transaction
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it("restarts scheduler after failed transaction (DB rolled back)", async () => {
    const { POST } = await import("@/app/api/settings/backup/restore/route")
    const { verifyPassword } = await import("@/lib/auth")
    const { deriveKey } = await import("@/lib/crypto")
    const { validateBackupJson } = await import("@/lib/backup")
    const { stopScheduler, ensureSchedulerRunning } = await import("@/lib/scheduler")

    vi.mocked(authenticate).mockResolvedValue({
      encryptionKey: "a".repeat(64),
    })
    vi.mocked(deriveKey).mockResolvedValue(Buffer.from("a".repeat(32)))
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(validateBackupJson).mockImplementation(() => undefined)

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            passwordHash: "hashed_password",
            encryptionSalt: "a".repeat(64),
          },
        ]),
      }),
    } as unknown as ReturnType<typeof db.select>)

    // Transaction throws (simulating DB constraint violation)
    ;(db.transaction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("unique constraint violation")
    )

    const req = createRestoreRequest(JSON.stringify(VALID_BACKUP), "a]3$kF9!mZq2vR7x")
    const res = await POST(req)

    expect(res.status).toBe(500)
    expect(stopScheduler).toHaveBeenCalledOnce()
    expect(ensureSchedulerRunning).toHaveBeenCalledOnce()
    expect(ensureSchedulerRunning).toHaveBeenCalledWith("a".repeat(64))
  })
})
