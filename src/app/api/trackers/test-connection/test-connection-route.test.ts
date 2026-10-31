// src/app/api/trackers/test-connection/test-connection-route.test.ts
//
// Tests for POST /api/trackers/test-connection: sanitized error responses,
// raw-error logging and proxy wiring from appSettings. The body names a registry
// slug, and the entry settles URL, platform and API path, so a slug the tracker
// list does not carry, or a defunct one, is refused before anything is sent.

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTrackerBySlug, TRACKER_REGISTRY } from "@/data/tracker-registry"
import { ALL_TRACKERS } from "@/data/trackers"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { log } from "@/lib/logger"
import { TRACKER_DEFUNCT_ERROR, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"
import { POST } from "./route"

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseJsonBody: vi.fn(),
    decodeKey: vi
      .fn()
      .mockReturnValue(
        Buffer.from("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "hex")
      ),
    validateMaxLength: vi.fn().mockReturnValue(null),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {
    proxyEnabled: "proxyEnabled",
    proxyType: "proxyType",
    proxyHost: "proxyHost",
    proxyPort: "proxyPort",
    proxyUsername: "proxyUsername",
    encryptedProxyPassword: "encryptedProxyPassword",
  },
}))

vi.mock("@/lib/tunnel", () => ({
  buildProxyAgentFromSettings: vi.fn().mockReturnValue(undefined),
}))

vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock all adapters via the adapters barrel. The test-connection route calls
// getAdapter(platform).fetchStats(...). We intercept at the adapter level so
// we can control success vs failure per test.
vi.mock("@/lib/tracker-platforms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tracker-platforms")>()
  return {
    ...actual,
    getAdapter: vi.fn().mockReturnValue({
      fetchStats: vi.fn().mockResolvedValue({ username: "testuser", group: "Member" }),
    }),
    buildFetchOptions: vi.fn().mockReturnValue({}),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_KEY = "a".repeat(64)

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/trackers/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const VALID_BODY = {
  slug: "aither",
  apiToken: "some-token",
}

function mockDbSettings(settings?: Record<string, unknown> | null) {
  const row =
    settings === null
      ? []
      : [
          {
            proxyEnabled: false,
            proxyType: "socks5",
            proxyHost: null,
            proxyPort: null,
            proxyUsername: null,
            encryptedProxyPassword: null,
            ...settings,
          },
        ]

  const mockLimit = vi.fn().mockResolvedValue(row)
  const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce({ from: mockFrom })
}

// ---------------------------------------------------------------------------
// Auth guards
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — auth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
  })

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  it("returns 400 when apiToken is missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ slug: "aither" })
    const res = await POST(makeRequest({ slug: "aither" }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe("apiToken is required")
  })

  // Nothing in the body but the slug can choose where the token goes.
  it.each([
    [
      "no slug, only a stored address",
      { baseUrl: "https://aither.cc", platformType: "unit3d" },
      TRACKER_UNLINKED_ERROR,
    ],
    ["a slug the tracker list does not carry", { slug: "no-such-tracker" }, TRACKER_UNLINKED_ERROR],
    [
      "a draft entry's slug",
      { slug: ALL_TRACKERS.find((t) => t.draft)?.slug },
      TRACKER_UNLINKED_ERROR,
    ],
    [
      "a defunct entry's slug",
      { slug: TRACKER_REGISTRY.find((t) => t.defunct)?.slug },
      TRACKER_DEFUNCT_ERROR,
    ],
  ])("refuses a body with %s before sending anything", async (_form, fields, error) => {
    expect(Object.values(fields), "the registry has no such entry left to test with").not.toContain(
      undefined
    )
    const body = { ...fields, apiToken: "some-token" }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    const { getAdapter } = await import("@/lib/tracker-platforms")

    const res = await POST(makeRequest(body))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error })
    expect(getAdapter).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Registry slug form
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection by registry slug", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  it("takes the URL, platform and API path from the entry, not from the body", async () => {
    mockDbSettings()
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "orpheus",
      apiToken: "some-token",
      baseUrl: "http://127.0.0.1:8080",
      platformType: "unit3d",
    })

    const { getAdapter } = await import("@/lib/tracker-platforms")
    const res = await POST(makeRequest({ slug: "orpheus", apiToken: "some-token" }))

    expect(res.status).toBe(200)
    expect(getAdapter).toHaveBeenCalledWith("gazelle")
    const resolved = vi.mocked(getAdapter).mock.results[0]?.value as {
      fetchStats: ReturnType<typeof vi.fn>
    }
    expect(resolved.fetchStats).toHaveBeenCalledWith(
      "https://orpheus.network",
      "some-token",
      "/ajax.php",
      expect.anything()
    )
  })

  it("passes the entry to buildFetchOptions so its auth options apply", async () => {
    mockDbSettings()
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "orpheus",
      apiToken: "some-token",
    })

    const { buildFetchOptions } = await import("@/lib/tracker-platforms")
    await POST(makeRequest({ slug: "orpheus", apiToken: "some-token" }))

    expect(buildFetchOptions).toHaveBeenCalledWith(
      expect.objectContaining({ entry: getTrackerBySlug("orpheus") })
    )
  })
})

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — success", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
  })

  it("returns 200 with success flag, username, and group on happy path", async () => {
    mockDbSettings()

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.username).toBe("testuser")
    expect(body.group).toBe("Member")
  })

  it("does not include encryptedApiToken or raw credentials in success response", async () => {
    mockDbSettings()

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(body).not.toHaveProperty("encryptedApiToken")
    expect(body).not.toHaveProperty("apiToken")
    expect(body).not.toHaveProperty("encryptedProxyPassword")
  })
})

// ---------------------------------------------------------------------------
// Error response, sanitized actual error
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — sanitized error response", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
  })

  it("returns sanitized ECONNREFUSED message instead of generic fallback", async () => {
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi
        .fn()
        .mockRejectedValueOnce(new Error("Failed to connect to avistaz.to: ECONNREFUSED")),
    })

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    // sanitizeNetworkError maps ECONNREFUSED -> "Connection refused"
    expect(body.error).toBe("Connection refused")
    expect(body.error).not.toBe("Tracker test failed")
  })

  it("returns sanitized timeout message instead of generic fallback", async () => {
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("Request to avistaz.to timed out")),
    })

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBe("Request timed out")
    expect(body.error).not.toBe("Tracker test failed")
  })

  it("returns sanitized auth failure message for 401 errors", async () => {
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("Tracker API error: 401 Unauthorized")),
    })

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBe("Authentication failed")
  })

  it("returns sanitized proxy error message when error contains 'proxy'", async () => {
    // Use a message that only triggers the proxy branch, not an earlier branch.
    // sanitizeNetworkError checks ECONNREFUSED before proxy, so use a proxy-only phrase.
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("Failed to connect via proxy server")),
    })

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBe("Proxy connection failed")
  })

  it("returns 'Tracker test failed' fallback for truly unrecognized errors", async () => {
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Something completely unknown happened that matches no pattern")
        ),
    })

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toBe("Tracker test failed")
  })

  it("does not leak raw error messages or internal details to the client", async () => {
    const rawMessage = "ECONNREFUSED 104.21.0.1:443 - secret-internal-ip"
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error(rawMessage)),
    })

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).not.toContain("104.21.0.1")
    expect(body.error).not.toContain("secret-internal-ip")
  })
})

// ---------------------------------------------------------------------------
// Error logging, platform, baseUrl, raw error in log
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — error log enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  it("logs the entry's platform and address in the warn payload when adapter throws", async () => {
    const body = { slug: "anthelion", apiToken: "some-token" }
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")),
    })

    await POST(makeRequest(body))

    expect(log.warn).toHaveBeenCalledOnce()
    const [payload] = (log.warn as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(payload).toMatchObject({ platform: "nebulance", baseUrl: "https://anthelion.me" })
  })

  it("logs the raw (unsanitized) error in the warn payload", async () => {
    const rawMsg = "Failed to connect to avistaz.to: ECONNREFUSED 104.21.0.1:443"
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
    mockDbSettings()
    const { getAdapter } = await import("@/lib/tracker-platforms")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error(rawMsg)),
    })

    await POST(makeRequest(VALID_BODY))

    const [payload] = (log.warn as ReturnType<typeof vi.fn>).mock.calls[0]
    // The raw message (with IP, ECONNREFUSED) must appear in the log, not in the response
    expect(payload.error).toContain("ECONNREFUSED")
    expect(payload.error).toBe(rawMsg)
  })

  it("does not log warn on success", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
    mockDbSettings()

    await POST(makeRequest(VALID_BODY))

    expect(log.warn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Proxy wiring
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — proxy wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
  })

  it("calls db.select to load proxy settings before running the adapter", async () => {
    mockDbSettings()

    await POST(makeRequest(VALID_BODY))

    expect(db.select).toHaveBeenCalled()
  })

  it("calls buildProxyAgentFromSettings with the fetched settings row", async () => {
    const settingsRow = {
      proxyEnabled: true,
      proxyType: "socks5",
      proxyHost: "proxy.internal",
      proxyPort: 1080,
      proxyUsername: null,
      encryptedProxyPassword: null,
    }
    mockDbSettings(settingsRow)

    await POST(makeRequest(VALID_BODY))

    expect(buildProxyAgentFromSettings).toHaveBeenCalledOnce()
    const [calledSettings] = (buildProxyAgentFromSettings as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(calledSettings).toMatchObject(settingsRow)
  })

  it("calls buildProxyAgentFromSettings with the decrypted encryption key", async () => {
    mockDbSettings()

    await POST(makeRequest(VALID_BODY))

    expect(decodeKey).toHaveBeenCalled()
    expect(buildProxyAgentFromSettings).toHaveBeenCalledOnce()
    const [, calledKey] = (buildProxyAgentFromSettings as ReturnType<typeof vi.fn>).mock.calls[0]
    // decodeKey mock returns a Buffer, verify that Buffer was passed
    expect(Buffer.isBuffer(calledKey)).toBe(true)
  })

  it("passes the proxy agent from buildProxyAgentFromSettings into buildFetchOptions", async () => {
    const fakeAgent = { isFakeAgent: true }
    ;(buildProxyAgentFromSettings as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeAgent)
    mockDbSettings({ proxyEnabled: true, proxyHost: "proxy.internal" })

    const { buildFetchOptions } = await import("@/lib/tracker-platforms")

    await POST(makeRequest(VALID_BODY))

    expect(buildFetchOptions).toHaveBeenCalledOnce()
    const [optsArg] = (buildFetchOptions as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(optsArg).toMatchObject({ proxyAgent: fakeAgent })
  })

  it("proceeds without proxy agent when settings row is absent (empty DB)", async () => {
    // Simulate no appSettings row at all (fresh install or missing row)
    mockDbSettings(null)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    // Should succeed, proxy is optional
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(buildProxyAgentFromSettings).not.toHaveBeenCalled()
  })

  it("proceeds without proxy when buildProxyAgentFromSettings returns undefined", async () => {
    ;(buildProxyAgentFromSettings as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined)
    mockDbSettings()

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })
})
