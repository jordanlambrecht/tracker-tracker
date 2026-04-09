// src/app/api/trackers/test-connection/test-connection-route.test.ts
//
// Tests for POST /api/trackers/test-connection
// Focuses on the three new behaviors added in the AvistaZ connection fix:
//   1. Returns sanitized actual error instead of generic "Tracker test failed"
//   2. Logs platform, baseUrl, and raw error in the msg field
//   3. Wires proxy settings from appSettings (DB load -> buildProxyAgentFromSettings)

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { log } from "@/lib/logger"
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
    validateHttpUrl: vi.fn().mockReturnValue(null),
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
vi.mock("@/lib/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adapters")>()
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
  baseUrl: "https://avistaz.to",
  apiToken: "some-token",
  platformType: "unit3d",
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

  it("returns 400 when baseUrl is missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      apiToken: "some-token",
      platformType: "unit3d",
    })
    const res = await POST(makeRequest({ apiToken: "some-token" }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/baseUrl.*required|required.*baseUrl/i)
  })

  it("returns 400 when apiToken is missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      baseUrl: "https://avistaz.to",
      platformType: "unit3d",
    })
    const res = await POST(makeRequest({ baseUrl: "https://avistaz.to" }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/required/)
  })

  it("returns 400 when platformType is not in VALID_PLATFORM_TYPES", async () => {
    // validateHttpUrl and validateMaxLength are vi.fn() returning null (pass-through),
    // so only the platform check fires here.
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      baseUrl: "https://avistaz.to",
      apiToken: "tok",
      platformType: "notaplatform",
    })
    const res = await POST(
      makeRequest({ baseUrl: "https://avistaz.to", apiToken: "tok", platformType: "notaplatform" })
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/platform/i)
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
// Error response — sanitized actual error (change 1 of 3)
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
    const { getAdapter } = await import("@/lib/adapters")
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
    const { getAdapter } = await import("@/lib/adapters")
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
    const { getAdapter } = await import("@/lib/adapters")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("HTTP 401 Unauthorized")),
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
    const { getAdapter } = await import("@/lib/adapters")
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
    const { getAdapter } = await import("@/lib/adapters")
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
    const rawMessage = "ECONNREFUSED 104.21.0.1:443 — secret-internal-ip"
    mockDbSettings()
    const { getAdapter } = await import("@/lib/adapters")
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
// Error logging — platform, baseUrl, raw error in log (change 2 of 3)
// ---------------------------------------------------------------------------

describe("POST /api/trackers/test-connection — error log enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
      encryptionKey: VALID_KEY,
    })
  })

  it("logs platform in the warn payload when adapter throws", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...VALID_BODY,
      platformType: "nebulance",
    })
    mockDbSettings()
    const { getAdapter } = await import("@/lib/adapters")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")),
    })

    await POST(makeRequest({ ...VALID_BODY, platformType: "nebulance" }))

    expect(log.warn).toHaveBeenCalledOnce()
    const [payload] = (log.warn as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(payload).toMatchObject({ platform: "nebulance" })
  })

  it("logs baseUrl in the warn payload when adapter throws", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...VALID_BODY,
      baseUrl: "https://nebulance.io",
    })
    mockDbSettings()
    const { getAdapter } = await import("@/lib/adapters")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")),
    })

    await POST(makeRequest({ ...VALID_BODY, baseUrl: "https://nebulance.io" }))

    const [payload] = (log.warn as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(payload).toMatchObject({ baseUrl: "https://nebulance.io" })
  })

  it("logs the raw (unsanitized) error in the warn payload", async () => {
    const rawMsg = "Failed to connect to avistaz.to: ECONNREFUSED 104.21.0.1:443"
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(VALID_BODY)
    mockDbSettings()
    const { getAdapter } = await import("@/lib/adapters")
    ;(getAdapter as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      fetchStats: vi.fn().mockRejectedValueOnce(new Error(rawMsg)),
    })

    await POST(makeRequest(VALID_BODY))

    const [payload] = (log.warn as ReturnType<typeof vi.fn>).mock.calls[0]
    // The raw message (with IP, ECONNREFUSED) must appear in the log, NOT in the response
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
// Proxy wiring (change 3 of 3)
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
    // decodeKey mock returns a Buffer — verify that Buffer was passed
    expect(Buffer.isBuffer(calledKey)).toBe(true)
  })

  it("passes the proxy agent from buildProxyAgentFromSettings into buildFetchOptions", async () => {
    const fakeAgent = { isFakeAgent: true }
    ;(buildProxyAgentFromSettings as ReturnType<typeof vi.fn>).mockReturnValueOnce(fakeAgent)
    mockDbSettings({ proxyEnabled: true, proxyHost: "proxy.internal" })

    const { buildFetchOptions } = await import("@/lib/adapters")

    await POST(makeRequest(VALID_BODY))

    expect(buildFetchOptions).toHaveBeenCalledOnce()
    const [, optsArg] = (buildFetchOptions as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(optsArg).toMatchObject({ proxyAgent: fakeAgent })
  })

  it("proceeds without proxy agent when settings row is absent (empty DB)", async () => {
    // Simulate no appSettings row at all (fresh install or missing row)
    mockDbSettings(null)

    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    // Should succeed — proxy is optional
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    // buildProxyAgentFromSettings should NOT have been called when settings row is absent
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
