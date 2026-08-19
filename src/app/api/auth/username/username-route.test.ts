// src/app/api/auth/username/username-route.test.ts
//
// This route sits under "/api/auth/", which src/proxy.ts treats as a PUBLIC_PREFIX
// — the proxy waves the request through before it looks at a session cookie. The
// handler's own authenticate() call is the entire access control story, so the
// unauthenticated case is tested first and by name rather than left implied.
//
// The validation cases are lifted from the setup route deliberately: both call
// the same validateUsername(), and a divergence between them would mean an
// account could be given a username that its own login form could not have
// created.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: {},
}))

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

/** Row returned by the route's `select ... from app_settings limit 1`. */
function mockSettingsRow(row: unknown) {
  const limit = vi.fn().mockResolvedValue(row === null ? [] : [row])
  const from = vi.fn().mockReturnValue({ limit })
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from })
}

/** Captures what the route writes, so the stored value can be asserted. */
function mockUpdateChain() {
  const where = vi.fn().mockResolvedValue(undefined)
  const set = vi.fn().mockReturnValue({ where })
  ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set })
  return { set, where }
}

function post(body: unknown) {
  return new Request("http://localhost/api/auth/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

/** Signed in with a real (non-pending) session and no username stored yet. */
function signedInWithoutUsername() {
  ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "deadbeef" })
  mockSettingsRow({ id: 1, username: null })
  return mockUpdateChain()
}

describe("POST /api/auth/username", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // "/api/auth/" is a PUBLIC_PREFIX in src/proxy.ts, so the proxy waves this path
  // through without looking at a cookie. This 401 is the whole boundary.
  //
  // It also covers the TOTP-pending case, and deliberately does not re-test it: a
  // password-only login that still owes a code holds a pending token, which is
  // returned in the response body and never written to tt_session, and getSession()
  // rejects any payload carrying a `purpose` claim (src/lib/auth.ts:82). Both roads
  // arrive here as "no session". Proving that branch needs a REAL pending token
  // driven through the real getSession, which is exactly what
  // src/lib/__tests__/auth-jwe.test.ts:166 does — a duplicate here with getSession
  // mocked to null would assert nothing and would keep passing if the guard were
  // deleted.
  it("rejects an unauthenticated caller", async () => {
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    mockSettingsRow({ id: 1, username: null })
    const { set } = mockUpdateChain()

    const { POST } = await import("./route")
    const response = await POST(post({ username: "newname" }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
    // The 401 must happen before anything is written, not alongside it.
    expect(set).not.toHaveBeenCalled()
  })

  it("stores a valid username and echoes the stored value back", async () => {
    const { set } = signedInWithoutUsername()

    const { POST } = await import("./route")
    const response = await POST(post({ username: "jordy" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, username: "jordy" })
    expect(set).toHaveBeenCalledWith({ username: "jordy" })
  })

  it("stores the trimmed value, not the raw input", async () => {
    const { set } = signedInWithoutUsername()

    const { POST } = await import("./route")
    const response = await POST(post({ username: "  spaced.name  " }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({ username: "spaced.name" })
  })

  // The bug this ordering prevents: " a " has a raw length of 3, so a
  // length-before-trim check passes it and then stores a 1-character username
  // that setup would have refused.
  it("rejects a username that is under the minimum only after trimming", async () => {
    const { set } = signedInWithoutUsername()

    const { POST } = await import("./route")
    const response = await POST(post({ username: " a " }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Username must be between 3 and 100 characters",
    })
    expect(set).not.toHaveBeenCalled()
  })

  it.each([
    ["missing", undefined, "Username is required"],
    ["not a string", 42, "Username is required"],
    ["whitespace only", "     ", "Username is required"],
    ["too short", "ab", "Username must be between 3 and 100 characters"],
    ["too long", "a".repeat(101), "Username must be between 3 and 100 characters"],
    [
      "containing a control character",
      "user\x00name",
      "Username may only contain letters, numbers, underscores, hyphens, dots, and spaces",
    ],
    [
      "containing markup",
      "<script>",
      "Username may only contain letters, numbers, underscores, hyphens, dots, and spaces",
    ],
  ])("rejects a username %s", async (_label, value, expected) => {
    const { set } = signedInWithoutUsername()

    const { POST } = await import("./route")
    const response = await POST(post({ username: value }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: expected })
    expect(set).not.toHaveBeenCalled()
  })

  it("accepts the boundary lengths setup accepts", async () => {
    const { POST } = await import("./route")

    for (const value of ["joe", "a".repeat(100)]) {
      const { set } = signedInWithoutUsername()
      const response = await POST(post({ username: value }))
      expect(response.status).toBe(200)
      expect(set).toHaveBeenCalledWith({ username: value })
    }
  })

  it("accepts every character class setup allows", async () => {
    const { set } = signedInWithoutUsername()

    const { POST } = await import("./route")
    const response = await POST(post({ username: "a_b-c.d 1" }))

    expect(response.status).toBe(200)
    expect(set).toHaveBeenCalledWith({ username: "a_b-c.d 1" })
  })

  it("returns 400 for invalid JSON", async () => {
    signedInWithoutUsername()

    const { POST } = await import("./route")
    const response = await POST(post("not-json{{{"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" })
  })

  it("returns 400 when the instance has not been set up", async () => {
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "deadbeef" })
    mockSettingsRow(null)
    const { set } = mockUpdateChain()

    const { POST } = await import("./route")
    const response = await POST(post({ username: "newname" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Not configured" })
    expect(set).not.toHaveBeenCalled()
  })

  // This endpoint only ever fills a NULL. Renaming is Settings › Account's job,
  // so a stale prompt left open in a second tab cannot rename the account.
  it("refuses to overwrite a username that is already set", async () => {
    ;(getSession as ReturnType<typeof vi.fn>).mockResolvedValue({ encryptionKey: "deadbeef" })
    mockSettingsRow({ id: 1, username: "existing" })
    const { set } = mockUpdateChain()

    const { POST } = await import("./route")
    const response = await POST(post({ username: "takeover" }))

    expect(response.status).toBe(409)
    expect(set).not.toHaveBeenCalled()
  })
})
