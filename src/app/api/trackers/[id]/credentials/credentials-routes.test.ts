// src/app/api/trackers/[id]/credentials/credentials-routes.test.ts
//
// Coverage for the credential vault routes.
//
// REAL crypto throughout (encrypt/decrypt from @/lib/crypto, real decodeKey):
// the encrypt → store → decrypt → project round trip IS the thing under test.
// Only the DB, the session lookup and the logger are mocked.
//
// The headline test is "the read route never returns a secret value". It
// asserts against the SERIALIZED response body rather than a parsed object,
// because that is what actually crosses the wire — a secret nested somewhere
// unexpected still shows up in the JSON string.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody, parseTrackerId } from "@/lib/api-helpers"
import { decrypt, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { requireCredentialVaultEnabled } from "@/lib/tracker-credentials/gate"
import { REVEAL_MAX_PER_WINDOW, resetRevealLimit } from "@/lib/tracker-credentials/reveal-limit"
import { POST as RevealPOST } from "./reveal/route"
import { GET, PUT } from "./route"

// decodeKey stays REAL — mocking it would defeat the crypto round trip.
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
  db: { select: vi.fn(), update: vi.fn() },
}))

vi.mock("@/lib/db/schema", () => ({
  trackers: {
    id: "trackers.id",
    name: "trackers.name",
    encryptedCredentials: "trackers.encryptedCredentials",
  },
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// The gate reads app_settings through a DIFFERENT chain shape than the tracker
// queries here (`.from().limit()`, no `.where()`), so it is mocked at the module
// boundary rather than bent into the shared select stub. Its own logic — most
// importantly "no settings row means disabled" — is covered separately in
// src/lib/__tests__/tracker-credential-gate.test.ts.
vi.mock("@/lib/tracker-credentials/gate", () => ({
  requireCredentialVaultEnabled: vi.fn(),
  CREDENTIAL_VAULT_DISABLED_ERROR: "The credential vault is disabled.",
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const KEY = Buffer.alloc(32, 7)
const NICKSERV_PASSWORD = "hunter2-nickserv"
const PASSKEY = "abcdef0123456789-passkey"

const VAULT = {
  v: 1,
  sections: [
    {
      id: "irc",
      title: "IRC",
      fields: [
        // secret: false — an IRC nick is not a secret, and the flag exists so
        // the sheet can render it without a reveal round trip.
        { id: "irc_nick", label: "Nick", value: "jordy", secret: false },
        // `secret` ABSENT. Fail closed: this must be treated as a secret.
        { id: "irc_nickserv", label: "NickServ password", value: NICKSERV_PASSWORD },
      ],
    },
    {
      id: "rss",
      title: "RSS",
      fields: [{ id: "passkey", label: "Passkey", value: PASSKEY, secret: true }],
    },
  ],
}

let trackerRow: Record<string, unknown> | undefined
let updateWrites: Record<string, unknown>[]

function selectChain() {
  return {
    from: () => ({
      where: () => ({ limit: () => Promise.resolve(trackerRow ? [trackerRow] : []) }),
    }),
  }
}

function get() {
  return GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: "1" }) })
}

function put(body: unknown) {
  ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue(body)
  return PUT(new Request("http://localhost/x", { method: "PUT" }), {
    params: Promise.resolve({ id: "1" }),
  })
}

function reveal(fieldId: unknown) {
  ;(parseJsonBody as ReturnType<typeof vi.fn>).mockResolvedValue({ fieldId })
  return RevealPOST(new Request("http://localhost/x", { method: "POST" }), {
    params: Promise.resolve({ id: "1" }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRevealLimit()
  updateWrites = []
  trackerRow = {
    id: 1,
    name: "Alpha",
    encryptedCredentials: encrypt(JSON.stringify(VAULT), KEY),
  }
  ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
    encryptionKey: KEY.toString("hex"),
  })
  ;(parseTrackerId as ReturnType<typeof vi.fn>).mockResolvedValue(1)
  // null == "the feature is on". The gate's closed behaviour is exercised in its
  // own describe block below.
  ;(requireCredentialVaultEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue(selectChain())
  ;(db.update as ReturnType<typeof vi.fn>).mockReturnValue({
    set: (values: Record<string, unknown>) => {
      updateWrites.push(values)
      return { where: () => Promise.resolve([]) }
    },
  })
})

// ─── The headline guarantee ───────────────────────────────────────────────────

describe("GET /api/trackers/[id]/credentials — no secret ever leaves", () => {
  it("never puts a secret value in the response body", async () => {
    const response = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "1" }),
    })
    expect(response.status).toBe(200)

    // The serialized body, not a parsed object: this is what crosses the wire,
    // and a secret hiding on some unexpected key still shows up in the string.
    const raw = JSON.stringify(await response.json())
    expect(raw).not.toContain(NICKSERV_PASSWORD)
    expect(raw).not.toContain(PASSKEY)
  })

  it("omits the `value` key entirely on secret fields, rather than blanking it", async () => {
    const body = (await (await get()).json()) as {
      vault: { sections: { fields: Record<string, unknown>[] }[] }
    }

    const nickserv = body.vault.sections[0].fields[1]
    // Structural exclusion. A blanked `value: ""` would still be a property one
    // careless spread away from carrying plaintext again.
    expect(nickserv).not.toHaveProperty("value")
    expect(nickserv.secret).toBe(true)
    // hasValue is a boolean, never a length — a length is a plaintext oracle.
    expect(nickserv.hasValue).toBe(true)

    const passkey = body.vault.sections[1].fields[0]
    expect(passkey).not.toHaveProperty("value")
  })

  it("treats a field with `secret` ABSENT as secret — fail closed", async () => {
    // The NickServ field in the fixture has no `secret` key at all. A bare
    // `if (field.secret)` would read undefined as falsy and render it public.
    const body = (await (await get()).json()) as {
      vault: { sections: { fields: Record<string, unknown>[] }[] }
    }
    const nickserv = body.vault.sections[0].fields[1]
    expect(nickserv.secret).toBe(true)
    expect(nickserv).not.toHaveProperty("value")
  })

  it("does carry the value of a field explicitly marked secret: false", async () => {
    const body = (await (await get()).json()) as {
      vault: { sections: { fields: Record<string, unknown>[] }[] }
    }
    // That is the whole meaning of the flag — no reveal round trip for an IRC
    // nick or an announce URL.
    expect(body.vault.sections[0].fields[0]).toMatchObject({
      id: "irc_nick",
      secret: false,
      value: "jordy",
    })
  })

  it("reports hasValue false for a secret field that is stored but empty", async () => {
    trackerRow = {
      id: 1,
      name: "Alpha",
      encryptedCredentials: encrypt(
        JSON.stringify({
          v: 1,
          sections: [
            { id: "api", title: "API", fields: [{ id: "api_key", label: "API key", value: "" }] },
          ],
        }),
        KEY
      ),
    }
    const body = (await (await get()).json()) as {
      vault: { sections: { fields: Record<string, unknown>[] }[] }
    }
    expect(body.vault.sections[0].fields[0].hasValue).toBe(false)
  })

  it("returns vault: null for a tracker with no vault, without calling decrypt", async () => {
    trackerRow = { id: 1, name: "Alpha", encryptedCredentials: null }
    const response = await get()
    expect(response.status).toBe(200)
    // NULL is "no vault" — a normal state, not an error. Handing NULL to
    // decrypt() is the trap this whole column is shaped to avoid.
    await expect(response.json()).resolves.toEqual({ vault: null })
  })

  it("404s for an unknown tracker", async () => {
    trackerRow = undefined
    expect((await get()).status).toBe(404)
  })

  it("401s without a session", async () => {
    const { NextResponse } = await import("next/server")
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    expect((await get()).status).toBe(401)
  })
})

// ─── Write ────────────────────────────────────────────────────────────────────

describe("PUT /api/trackers/[id]/credentials", () => {
  it("stores ciphertext that decrypts back to exactly what was sent", async () => {
    const response = await put({ vault: VAULT })
    expect(response.status).toBe(200)

    expect(updateWrites).toHaveLength(1)
    const stored = updateWrites[0].encryptedCredentials as string
    expect(JSON.parse(decrypt(stored, KEY))).toEqual(VAULT)
  })

  it("stores NULL — not an encrypted empty vault — when the last section goes", async () => {
    const response = await put({ vault: { v: 1, sections: [] } })
    expect(response.status).toBe(200)
    // "No vault" must have exactly ONE representation, or every reader has to
    // know both. NULL is it.
    expect(updateWrites[0].encryptedCredentials).toBeNull()
  })

  it("stores NULL for an explicit null vault", async () => {
    const response = await put({ vault: null })
    expect(response.status).toBe(200)
    expect(updateWrites[0].encryptedCredentials).toBeNull()
  })

  it("never stores an empty string", async () => {
    await put({ vault: { v: 1, sections: [] } })
    expect(updateWrites[0].encryptedCredentials).not.toBe("")
  })

  it("rejects a vault that fails validation, writing nothing", async () => {
    const response = await put({
      vault: {
        v: 1,
        sections: [
          {
            id: "irc",
            title: "IRC",
            fields: [
              { id: "dupe", label: "One", value: "a" },
              { id: "dupe", label: "Two", value: "b" },
            ],
          },
        ],
      },
    })
    expect(response.status).toBe(400)
    // Field ids are unique across the WHOLE vault — the reveal endpoint
    // resolves by id with no section context, so a duplicate is ambiguous.
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Duplicate field id"),
    })
    expect(updateWrites).toHaveLength(0)
  })

  it("rejects a vault of an unknown version", async () => {
    const response = await put({ vault: { v: 2, sections: [] } })
    // v:2 with an empty sections array still clears — but a v:2 with content
    // must fail closed rather than being guessed at.
    expect(response.status).toBe(200)

    updateWrites = []
    const withContent = await put({
      vault: { v: 2, sections: [{ id: "a", title: "A", fields: [] }] },
    })
    expect(withContent.status).toBe(400)
    expect(updateWrites).toHaveLength(0)
  })

  it("404s for an unknown tracker without writing", async () => {
    trackerRow = undefined
    expect((await put({ vault: VAULT })).status).toBe(404)
    expect(updateWrites).toHaveLength(0)
  })
})

// ─── Merge-on-write ───────────────────────────────────────────────────────────
//
// The sheet loads MASKED, so it physically cannot send back a secret it was
// never shown. Every one of these tests is really the same test: that editing
// anything at all does not wipe the secrets the user could not see.

describe("PUT merges omitted values against what is stored", () => {
  /** What the sheet actually sends after the user renames a section: no values. */
  const RENAMED_WITHOUT_VALUES = {
    v: 1,
    sections: [
      {
        id: "irc",
        title: "IRC (renamed)",
        fields: [
          { id: "irc_nick", label: "Nick", value: "jordy", secret: false },
          { id: "irc_nickserv", label: "NickServ password" },
        ],
      },
      {
        id: "rss",
        title: "RSS",
        fields: [{ id: "passkey", label: "Passkey", secret: true }],
      },
    ],
  }

  function storedVault() {
    return JSON.parse(decrypt(updateWrites[0].encryptedCredentials as string, KEY)) as {
      sections: { title: string; fields: { id: string; value: string }[] }[]
    }
  }

  it("PRESERVES secret plaintext when the sheet omits it", async () => {
    // THE test for this phase. Without the merge, renaming a section would send
    // every secret back as undefined and the save would silently destroy them —
    // while showing the user a successful save.
    const response = await put({ vault: RENAMED_WITHOUT_VALUES })
    expect(response.status).toBe(200)

    const stored = storedVault()
    expect(stored.sections[0].title).toBe("IRC (renamed)")
    expect(stored.sections[0].fields[1].value).toBe(NICKSERV_PASSWORD)
    expect(stored.sections[1].fields[0].value).toBe(PASSKEY)
  })

  it("replaces a value when one IS sent", async () => {
    await put({
      vault: {
        v: 1,
        sections: [
          {
            id: "rss",
            title: "RSS",
            fields: [{ id: "passkey", label: "Passkey", value: "brand-new-passkey" }],
          },
        ],
      },
    })
    expect(storedVault().sections[0].fields[0].value).toBe("brand-new-passkey")
  })

  it("treats an explicit empty string as a CLEAR, not as 'keep what you have'", async () => {
    // The distinction the whole merge turns on. A truthiness check here (`||`
    // instead of `!== undefined`) would make the Clear button silently do
    // nothing, and the user would believe a secret had been removed.
    await put({
      vault: {
        v: 1,
        sections: [{ id: "rss", title: "RSS", fields: [{ id: "passkey", label: "P", value: "" }] }],
      },
    })
    expect(storedVault().sections[0].fields[0].value).toBe("")
  })

  it("starts a brand-new field at empty rather than inheriting anything", async () => {
    await put({
      vault: {
        v: 1,
        sections: [
          {
            id: "rss",
            title: "RSS",
            fields: [
              { id: "passkey", label: "Passkey" },
              { id: "freshly_added", label: "Freshly added" },
            ],
          },
        ],
      },
    })
    const fields = storedVault().sections[0].fields
    expect(fields[0].value).toBe(PASSKEY)
    expect(fields[1].value).toBe("")
  })

  it("carries a secret with a field moved to another section", async () => {
    // The stored index is keyed by id ACROSS the vault, not per section, so
    // reorganising sections is not a data-loss event.
    await put({
      vault: {
        v: 1,
        sections: [
          { id: "irc", title: "IRC", fields: [{ id: "passkey", label: "Passkey" }] },
        ],
      },
    })
    expect(storedVault().sections[0].fields[0].value).toBe(PASSKEY)
  })

  it("REFUSES to save when the stored vault cannot be read, rather than blanking it", async () => {
    trackerRow = { id: 1, name: "Alpha", encryptedCredentials: "not-valid-ciphertext" }

    const response = await put({ vault: RENAMED_WITHOUT_VALUES })

    // Treating an unreadable vault as empty would merge every omitted value to ""
    // and destroy the lot behind a green "Saved". Refusing leaves the ciphertext
    // exactly where it is, so a recover.cjs run still has something to work with.
    expect(response.status).toBe(500)
    expect(updateWrites).toHaveLength(0)
    const body = JSON.stringify(await response.json())
    expect(body).toContain("nothing was saved")
    expect(body).not.toContain(NICKSERV_PASSWORD)
  })

  it("still clears to NULL even when the stored vault is unreadable", async () => {
    // The escape hatch from the refusal above: a corrupt vault must not be a
    // permanent dead end, and clearing needs no merge and therefore no decrypt.
    trackerRow = { id: 1, name: "Alpha", encryptedCredentials: "not-valid-ciphertext" }
    expect((await put({ vault: null })).status).toBe(200)
    expect(updateWrites[0].encryptedCredentials).toBeNull()
  })

  it("rejects a non-string value instead of coercing it", async () => {
    const response = await put({
      vault: {
        v: 1,
        sections: [
          { id: "rss", title: "RSS", fields: [{ id: "passkey", label: "P", value: 12345 }] },
        ],
      },
    })
    expect(response.status).toBe(400)
    expect(updateWrites).toHaveLength(0)
  })
})

// ─── The opt-in gate ──────────────────────────────────────────────────────────

describe("the credential vault opt-in gate closes every route", () => {
  beforeEach(async () => {
    const { NextResponse } = await import("next/server")
    ;(requireCredentialVaultEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "disabled", credentialVaultDisabled: true }, { status: 403 })
    )
  })

  it("403s the read", async () => {
    expect((await get()).status).toBe(403)
  })

  it("403s the write, without touching the row", async () => {
    expect((await put({ vault: VAULT })).status).toBe(403)
    expect(updateWrites).toHaveLength(0)
  })

  it("403s the reveal, and returns no plaintext", async () => {
    const response = await reveal("irc_nickserv")
    expect(response.status).toBe(403)
    // The point of gating server-side: a disabled feature must not leave a live
    // secret-dispensing URL behind it.
    expect(JSON.stringify(await response.json())).not.toContain(NICKSERV_PASSWORD)
  })

  it("marks the refusal with a field, not a message the sheet has to string-match", async () => {
    const body = (await (await get()).json()) as Record<string, unknown>
    expect(body.credentialVaultDisabled).toBe(true)
  })
})

// ─── Reveal ───────────────────────────────────────────────────────────────────

describe("POST /api/trackers/[id]/credentials/reveal", () => {
  it("returns the plaintext of exactly one field, looked up by id alone", async () => {
    const response = await reveal("irc_nickserv")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ value: NICKSERV_PASSWORD })
  })

  it("resolves a field in a later section — ids are unique vault-wide", async () => {
    const response = await reveal("passkey")
    await expect(response.json()).resolves.toEqual({ value: PASSKEY })
  })

  it("returns ONLY that field's value, never its neighbours", async () => {
    const raw = JSON.stringify(await (await reveal("passkey")).json())
    expect(raw).toContain(PASSKEY)
    expect(raw).not.toContain(NICKSERV_PASSWORD)
  })

  it("404s for a field id that is not in the vault", async () => {
    expect((await reveal("no_such_field")).status).toBe(404)
  })

  it("404s when the tracker has no vault at all", async () => {
    trackerRow = { id: 1, name: "Alpha", encryptedCredentials: null }
    expect((await reveal("irc_nickserv")).status).toBe(404)
  })

  it("400s on a field id that is not a slug, before any lookup", async () => {
    expect((await reveal("../../etc/passwd")).status).toBe(400)
    expect((await reveal(42)).status).toBe(400)
    // A hostile multi-megabyte id is rejected by the slug rule, which bounds
    // length at 64, so it is never interpolated into an error string.
    expect((await reveal("a".repeat(1_000_000))).status).toBe(400)
  })

  it("429s once the window's reveal budget is spent", async () => {
    for (let i = 0; i < REVEAL_MAX_PER_WINDOW; i++) {
      expect((await reveal("irc_nickserv")).status).toBe(200)
    }
    const blocked = await reveal("irc_nickserv")
    // The cap is a blast-radius limit, not anti-abuse: it turns a stolen
    // session into a slow drain that shows up in the log rather than an
    // instant dump of every secret in the vault.
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("Retry-After")).toBeTruthy()
    const body = JSON.stringify(await blocked.json())
    expect(body).not.toContain(NICKSERV_PASSWORD)
  })

  it("401s without a session", async () => {
    const { NextResponse } = await import("next/server")
    ;(authenticate as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    )
    expect((await reveal("irc_nickserv")).status).toBe(401)
  })
})
