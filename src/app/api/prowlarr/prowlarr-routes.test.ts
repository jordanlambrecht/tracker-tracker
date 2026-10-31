// src/app/api/prowlarr/prowlarr-routes.test.ts

import { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate } from "@/lib/api-helpers"
import { decrypt, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { testProwlarrInstance } from "@/lib/prowlarr/sync"
import { requestProwlarrPoll } from "@/lib/prowlarr-scheduler"
import { DELETE, PATCH } from "./[id]/route"
import { POST as TEST } from "./[id]/test/route"
import { GET as INDEXERS } from "./indexers/route"
import { GET, POST } from "./route"

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return { ...actual, authenticate: vi.fn() }
})

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock("@/lib/prowlarr/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prowlarr/sync")>()
  return {
    ...actual,
    testProwlarrInstance: vi.fn(),
    listIndexerOptions: vi.fn(async () => []),
  }
})

vi.mock("@/lib/prowlarr-scheduler", () => ({
  requestProwlarrPoll: vi.fn(async () => undefined),
}))

vi.mock("@/lib/server-data", () => ({
  fetchProwlarrInstances: vi.fn().mockResolvedValue([]),
  serializeProwlarrInstance: vi.fn((i: unknown) => i),
}))

const VALID_KEY = "abcd1234".repeat(8)
const API_KEY = "0123456789abcdef0123456789abcdef"

function jsonRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/prowlarr", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

function mockInsertReturning(row: Record<string, unknown>) {
  const values = vi.fn(() => ({ returning: vi.fn(async () => [row]) }))
  vi.mocked(db.insert).mockReturnValue({ values } as unknown as ReturnType<typeof db.insert>)
  return values
}

function mockSelectRow(row: Record<string, unknown> | null) {
  const limit = vi.fn(async () => (row ? [row] : []))
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit }) }),
  } as unknown as ReturnType<typeof db.select>)
}

function mockUpdate() {
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }))
  vi.mocked(db.update).mockReturnValue({ set } as unknown as ReturnType<typeof db.update>)
  return set
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authenticate).mockResolvedValue({ encryptionKey: VALID_KEY })
})

describe("auth gate", () => {
  it.each([
    ["GET /api/prowlarr", () => GET()],
    ["GET /api/prowlarr/indexers", () => INDEXERS()],
    ["PATCH /api/prowlarr/[id]", () => PATCH(jsonRequest({}, "PATCH"), params("1"))],
    ["DELETE /api/prowlarr/[id]", () => DELETE(new Request("http://localhost"), params("1"))],
    ["POST /api/prowlarr/[id]/test", () => TEST(new Request("http://localhost"), params("1"))],
  ])("%s returns 401 without a session", async (_name, call) => {
    vi.mocked(authenticate).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    expect((await call()).status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })
})

describe("POST /api/prowlarr", () => {
  it("requires a session", async () => {
    vi.mocked(authenticate).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    const res = await POST(
      jsonRequest({ name: "Home", url: "http://prowlarr.test:9696", apiKey: API_KEY })
    )
    expect(res.status).toBe(401)
  })

  it("encrypts the key, normalizes the URL and starts a first poll", async () => {
    const values = mockInsertReturning({ id: 3, name: "Home" })

    const res = await POST(
      jsonRequest({ name: " Home ", url: "http://prowlarr.test:9696/", apiKey: ` ${API_KEY} ` })
    )

    expect(res.status).toBe(201)
    const inserted = (values.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(inserted.name).toBe("Home")
    expect(inserted.url).toBe("http://prowlarr.test:9696")
    expect(inserted.encryptedApiKey).not.toContain(API_KEY)
    expect(decrypt(inserted.encryptedApiKey as string, Buffer.from(VALID_KEY, "hex"))).toBe(API_KEY)
    expect(requestProwlarrPoll).toHaveBeenCalledWith(3, expect.any(Buffer), { readIndexers: true })
    expect(JSON.stringify(await res.json())).not.toContain(API_KEY)
  })

  it.each([
    [{ url: "http://prowlarr.test:9696", apiKey: API_KEY }, /required/],
    [{ name: "Home", url: "ftp://prowlarr", apiKey: API_KEY }, /http/],
    [{ name: "Home", url: "http://u:p@prowlarr", apiKey: API_KEY }, /username or password/],
    // Both would send every request to Prowlarr's root.
    [{ name: "Home", url: "http://prowlarr.test:9696/?", apiKey: API_KEY }, /query/],
    [{ name: "Home", url: "http://prowlarr.test:9696/#", apiKey: API_KEY }, /query/],
    [{ name: "Home", url: "http://prowlarr.test:9696", apiKey: "" }, /API key is required/],
    [{ name: "Home", url: "http://prowlarr.test:9696", apiKey: "has space" }, /printable/],
    [{ name: "", url: "http://prowlarr.test:9696", apiKey: API_KEY }, /Name/],
  ])("rejects %j", async (body, message) => {
    const res = await POST(jsonRequest(body))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(message)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe("PATCH /api/prowlarr/[id]", () => {
  it("returns 404 for an unknown instance", async () => {
    mockSelectRow(null)
    const res = await PATCH(jsonRequest({ name: "New" }, "PATCH"), params("9"))
    expect(res.status).toBe(404)
  })

  it("re-encrypts a new key, clears the stale error and refreshes", async () => {
    mockSelectRow({ id: 1 })
    const set = mockUpdate()

    const res = await PATCH(jsonRequest({ apiKey: API_KEY }, "PATCH"), params("1"))

    expect(res.status).toBe(200)
    const updates = (set.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(decrypt(updates.encryptedApiKey as string, Buffer.from(VALID_KEY, "hex"))).toBe(API_KEY)
    expect(updates.lastError).toBeNull()
    expect(requestProwlarrPoll).toHaveBeenCalledWith(1, expect.any(Buffer), { readIndexers: true })
  })

  // The API key has its own encrypted column, so a URL must not carry one in plain text.
  it.each([
    ["http://user:secret@prowlarr.test:9696", /username or password/],
    ["http://prowlarr.test:9696/?apikey=secret", /query/],
    ["ftp://prowlarr.test", /http/],
  ])("refuses the URL %s", async (url, message) => {
    mockSelectRow({ id: 1 })
    const set = mockUpdate()

    const res = await PATCH(jsonRequest({ url }, "PATCH"), params("1"))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(message)
    expect(set).not.toHaveBeenCalled()
  })

  it("renames without touching the key or polling", async () => {
    mockSelectRow({ id: 1 })
    const set = mockUpdate()

    await PATCH(jsonRequest({ name: "Renamed" }, "PATCH"), params("1"))

    const updates = (set.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(updates.name).toBe("Renamed")
    expect(updates).not.toHaveProperty("encryptedApiKey")
    expect(requestProwlarrPoll).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/prowlarr/[id]", () => {
  function mockDelete(rows: { id: number }[]) {
    const where = vi.fn(() => ({ returning: vi.fn(async () => rows) }))
    vi.mocked(db.delete).mockReturnValue({ where } as unknown as ReturnType<typeof db.delete>)
  }

  // Trackers' pins are cleared by the foreign key, so the route writes nothing to them.
  it("deletes the instance and touches no tracker", async () => {
    mockDelete([{ id: 4 }])

    const res = await DELETE(new Request("http://localhost/api/prowlarr/4"), params("4"))

    expect(res.status).toBe(200)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("returns 404 when nothing was deleted", async () => {
    mockDelete([])
    const res = await DELETE(new Request("http://localhost/api/prowlarr/4"), params("4"))
    expect(res.status).toBe(404)
  })
})

describe("POST /api/prowlarr/[id]/test", () => {
  it("reports the version on success", async () => {
    mockSelectRow({ url: "http://prowlarr.test:9696", encryptedApiKey: "ciphertext" })
    vi.mocked(testProwlarrInstance).mockResolvedValue({ version: "1.2.3" })

    const res = await TEST(new Request("http://localhost/api/prowlarr/1/test"), params("1"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ version: "1.2.3" })
  })

  it("passes the sanitized error through as a 502", async () => {
    mockSelectRow({ url: "http://prowlarr.test:9696", encryptedApiKey: "ciphertext" })
    vi.mocked(testProwlarrInstance).mockResolvedValue({ error: "API key rejected by Prowlarr" })

    const res = await TEST(new Request("http://localhost/api/prowlarr/1/test"), params("1"))

    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe("API key rejected by Prowlarr")
  })

  // A session key that cannot open the stored key is stale, and the answer must
  // not lead to the key being re-entered under it.
  it("answers a key that will not decrypt with an expired session", async () => {
    const actual =
      await vi.importActual<typeof import("@/lib/prowlarr/sync")>("@/lib/prowlarr/sync")
    vi.mocked(testProwlarrInstance).mockImplementation(actual.testProwlarrInstance)
    mockSelectRow({
      url: "http://prowlarr.test:9696",
      encryptedApiKey: encrypt(API_KEY, Buffer.alloc(32, 9)),
    })

    const res = await TEST(new Request("http://localhost/api/prowlarr/1/test"), params("1"))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe("Session expired. Please log in again")
  })
})
