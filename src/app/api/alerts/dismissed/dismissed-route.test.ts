// src/app/api/alerts/dismissed/dismissed-route.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
// biome-ignore lint/correctness/noUnusedImports: used in vi.mock factory below
import { NON_DISMISSIBLE_ALERT_TYPES, pruneDismissedAlerts } from "@/lib/alert-pruning"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { DELETE, GET, POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn(),
    parseJsonBody: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  dismissedAlerts: {},
}))

vi.mock("@/lib/alert-pruning", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/alert-pruning")>()
  return {
    EXPIRING_ALERT_TYPES: actual.EXPIRING_ALERT_TYPES,
    NON_DISMISSIBLE_ALERT_TYPES: actual.NON_DISMISSIBLE_ALERT_TYPES,
    ALERT_EXPIRY_MS: actual.ALERT_EXPIRY_MS,
    pruneDismissedAlerts: vi.fn().mockResolvedValue(undefined),
  }
})

function mockAuthSuccess() {
  ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "test" })
}

function makeRequest(url: string, body?: Record<string, unknown>, method = "GET") {
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { "Content-Type": "application/json" }
  }
  return new Request(url, init)
}

describe("GET /api/alerts/dismissed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess()
  })

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("prunes expired rows and returns remaining keys", async () => {
    const mockSelectFrom = vi
      .fn()
      .mockResolvedValue([{ alertKey: "active-1" }, { alertKey: "active-2" }])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockSelectFrom })

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.keys).toEqual(["active-1", "active-2"])
    expect(pruneDismissedAlerts).toHaveBeenCalledOnce()
  })

  it("returns empty keys array when none exist", async () => {
    const mockSelectFrom = vi.fn().mockResolvedValue([])
    ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockSelectFrom })

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.keys).toEqual([])
    expect(pruneDismissedAlerts).toHaveBeenCalledOnce()
  })
})

describe("POST /api/alerts/dismissed — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess()
  })

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const req = makeRequest(
      "http://localhost/api/alerts/dismissed",
      { key: "k", type: "t" },
      "POST"
    )
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when key is missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ type: "stale-data" })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("key must be a non-empty string")
  })

  it("returns 400 when key is empty (whitespace only)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "   ",
      type: "stale-data",
    })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("key must be a non-empty string")
  })

  it("returns 400 when key exceeds 255 characters", async () => {
    const longKey = "a".repeat(256)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: longKey,
      type: "stale-data",
    })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("key must be 255 characters or fewer")
  })

  it("returns 400 when type is missing", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ key: "valid-key" })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("type must be a non-empty string")
  })

  it("returns 400 when type is empty (whitespace only)", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "valid-key",
      type: "   ",
    })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("type must be a non-empty string")
  })

  it("returns 400 when type exceeds 30 characters", async () => {
    const longType = "a".repeat(31)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "valid-key",
      type: longType,
    })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("type must be 30 characters or fewer")
  })

  it("accepts key at exactly 255 characters", async () => {
    const maxKey = "a".repeat(255)
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: maxKey,
      type: "stale-data",
    })

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it("inserts a valid dismissal and returns success", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "my-alert",
      type: "stale-data",
    })

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith({ alertKey: "my-alert", alertType: "stale-data" })
    expect(mockOnConflictDoNothing).toHaveBeenCalled()
  })
})

describe("POST /api/alerts/dismissed — non-dismissible rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess()
  })

  it("rejects dismissing a client-error alert type", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "some-key",
      type: "client-error",
    })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("This alert type cannot be dismissed")
  })

  it("rejects dismissing a poll-paused alert type", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "poll-paused-1",
      type: "poll-paused",
    })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("This alert type cannot be dismissed")
  })

  it("allows dismissing stale-data alert type", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "some-key",
      type: "stale-data",
    })

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
  })

  it("allows dismissing zero-seeding alert type", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "some-key",
      type: "zero-seeding",
    })

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it("allows dismissing an arbitrary non-blocked type", async () => {
    ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "some-key",
      type: "custom-type",
    })

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing })
    ;(db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "POST")
    const res = await POST(req)

    expect(res.status).toBe(200)
  })
})

describe("DELETE /api/alerts/dismissed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthSuccess()
  })

  it("returns 401 when not authenticated", async () => {
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "DELETE")
    const res = await DELETE(req)
    expect(res.status).toBe(401)
  })

  it("deletes a specific alert when ?key is provided", async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined)
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockWhere })

    const req = makeRequest(
      "http://localhost/api/alerts/dismissed?key=some-alert-key",
      undefined,
      "DELETE"
    )
    const res = await DELETE(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(db.delete).toHaveBeenCalledTimes(1)
    expect(mockWhere).toHaveBeenCalledTimes(1)
  })

  it("deletes all alerts when no ?key is provided", async () => {
    ;(db.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "DELETE")
    const res = await DELETE(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(db.delete).toHaveBeenCalledTimes(1)
  })

  it("does not call .where() when no key param is present", async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined)
    // Return an object with a where method, but the route should NOT call it
    ;(db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockWhere })

    const req = makeRequest("http://localhost/api/alerts/dismissed", undefined, "DELETE")
    await DELETE(req)

    // The route calls db.delete(dismissedAlerts) without .where() when key is null
    // Since db.delete is called and returns the mock, but .where is not chained,
    // we verify .where was not invoked
    expect(mockWhere).not.toHaveBeenCalled()
  })
})
