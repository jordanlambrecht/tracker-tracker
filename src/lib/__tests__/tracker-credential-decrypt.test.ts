// src/lib/__tests__/tracker-credential-decrypt.test.ts
//
// Functions: decryptTrackerCredentials (real crypto round-trip tests)
//
// Real crypto, no mocks — same reasoning as notification-decrypt.test.ts. The
// bugs worth catching live at the seam between decrypt(), JSON.parse and the
// shape guard: format changes, key mismatches, and above all the error-message
// shape, because a leaked crypto error tells an attacker whether the key was
// wrong and a leaked SyntaxError quotes plaintext back.

import { randomBytes, scryptSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { encrypt } from "@/lib/crypto"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"

/** Mirrors how the app derives keys (scrypt, 32 bytes) with a fast N for tests. */
function makeKey(password = "test-password", salt?: string): Buffer {
  const s = salt ?? randomBytes(16).toString("hex")
  return scryptSync(password, s, 32, { N: 1024, r: 8, p: 1 }) as Buffer
}

const GENERIC = 'Credentials are missing or invalid for tracker "Test Tracker"'

async function subject() {
  // Imported lazily so the "server-only" alias from vitest.config.ts is resolved
  // before the module's import guard runs.
  const { decryptTrackerCredentials } = await import("@/lib/tracker-credentials/decrypt")
  return decryptTrackerCredentials
}

describe("decryptTrackerCredentials", () => {
  it("round-trips a v1 vault UNCHANGED", async () => {
    const decryptTrackerCredentials = await subject()
    const key = makeKey()
    const original: TrackerCredentialVault = {
      v: 1,
      sections: [
        {
          id: "irc",
          title: "IRC",
          fields: [
            { id: "irc_nick", label: "Nick", value: "jordy", secret: false },
            { id: "irc_nickserv", label: "NickServ password", value: "hunter2", secret: true },
          ],
        },
        {
          id: "api",
          title: "API",
          // No `secret` key: absent means secret, and it must stay absent through
          // the round trip rather than being materialised as `true`.
          fields: [{ id: "api_key", label: "API key", value: "k-123" }],
        },
      ],
    }

    const result = decryptTrackerCredentials(
      { name: "Test Tracker", encryptedCredentials: encrypt(JSON.stringify(original), key) },
      key
    )

    expect(result).toEqual(original)
    expect(Object.hasOwn(result.sections[1].fields[0], "secret")).toBe(false)
  })

  it("preserves unknown additive keys so a newer build's data survives an older reader", async () => {
    const decryptTrackerCredentials = await subject()
    const key = makeKey()
    const original = {
      v: 1,
      notes: "top-level note",
      sections: [
        {
          id: "api",
          title: "API",
          icon: "key",
          fields: [
            {
              id: "api_key",
              label: "API key",
              value: "k",
              kind: "password",
              lastRotatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    }

    const result = decryptTrackerCredentials(
      { name: "Test Tracker", encryptedCredentials: encrypt(JSON.stringify(original), key) },
      key
    )

    expect(result).toEqual(original)
  })

  it("preserves array order — array order IS display order", async () => {
    const decryptTrackerCredentials = await subject()
    const key = makeKey()
    const original: TrackerCredentialVault = {
      v: 1,
      sections: [
        { id: "z_last", title: "Z", fields: [{ id: "z1", label: "Z1", value: "1" }] },
        { id: "a_first", title: "A", fields: [{ id: "a1", label: "A1", value: "2" }] },
      ],
    }

    const result = decryptTrackerCredentials(
      { name: "Test Tracker", encryptedCredentials: encrypt(JSON.stringify(original), key) },
      key
    )

    expect(result.sections.map((s) => s.id)).toEqual(["z_last", "a_first"])
  })

  it("round-trips empty values, which crypto.ts supports on purpose", async () => {
    const decryptTrackerCredentials = await subject()
    const key = makeKey()
    const original: TrackerCredentialVault = {
      v: 1,
      sections: [
        { id: "api", title: "API", fields: [{ id: "api_key", label: "API key", value: "" }] },
      ],
    }

    const result = decryptTrackerCredentials(
      { name: "Test Tracker", encryptedCredentials: encrypt(JSON.stringify(original), key) },
      key
    )

    expect(result).toEqual(original)
  })

  const failures: Array<[string, (key: Buffer) => { key: Buffer; ciphertext: string }]> = [
    [
      "the WRONG key",
      (key) => ({
        key: makeKey("different-password"),
        ciphertext: encrypt(JSON.stringify({ v: 1, sections: [] }), key),
      }),
    ],
    ["garbage that is not base64 ciphertext", (key) => ({ key, ciphertext: "not-ciphertext" })],
    ["an empty string", (key) => ({ key, ciphertext: "" })],
    [
      "a marker string of the kind lockdown must never write",
      (key) => ({ key, ciphertext: "LOCKDOWN_REVOKED" }),
    ],
    [
      "valid ciphertext holding non-JSON",
      (key) => ({ key, ciphertext: encrypt("hunter2-in-the-clear", key) }),
    ],
    ["valid ciphertext holding JSON null", (key) => ({ key, ciphertext: encrypt("null", key) })],
    [
      "valid ciphertext holding a non-vault object",
      (key) => ({ key, ciphertext: encrypt(JSON.stringify({ webhookUrl: "x" }), key) }),
    ],
    [
      "valid ciphertext holding a FUTURE vault version",
      (key) => ({ key, ciphertext: encrypt(JSON.stringify({ v: 2, sections: [] }), key) }),
    ],
    [
      "valid ciphertext holding a malformed field",
      (key) => ({
        key,
        ciphertext: encrypt(
          JSON.stringify({ v: 1, sections: [{ id: "a", title: "A", fields: [{ id: "x" }] }] }),
          key
        ),
      }),
    ],
  ]

  for (const [label, build] of failures) {
    it(`throws ONE generic message for ${label}`, async () => {
      const decryptTrackerCredentials = await subject()
      const { key, ciphertext } = build(makeKey())
      expect(() =>
        decryptTrackerCredentials({ name: "Test Tracker", encryptedCredentials: ciphertext }, key)
      ).toThrow(GENERIC)
    })
  }

  it("never leaks crypto internals, parse detail or plaintext in the message", async () => {
    const decryptTrackerCredentials = await subject()
    const key = makeKey()
    const leaky = encrypt("hunter2-in-the-clear", key)

    let message = ""
    try {
      decryptTrackerCredentials({ name: "Test Tracker", encryptedCredentials: leaky }, key)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe(GENERIC)
    expect(message).not.toMatch(/hunter2/)
    expect(message).not.toMatch(/JSON|Unexpected|token|position/i)
    expect(message).not.toMatch(/decipher|auth|GCM|cipher/i)
  })
})
