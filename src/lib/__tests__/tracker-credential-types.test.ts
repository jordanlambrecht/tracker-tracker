// src/lib/__tests__/tracker-credential-types.test.ts
//
// Functions: isTrackerCredentialVault, isFieldSecret
//
// The guard is the last line between whatever came out of decrypt() and code
// that indexes into `.sections[].fields[]`. It must reject everything malformed
// WITHOUT throwing, because callers use it as a boolean in an if, and it must
// tolerate unknown keys, because the whole additive-optional-key design in the
// architecture depends on a newer build's extra fields surviving an older reader.

import { describe, expect, it } from "vitest"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"
import {
  isFieldSecret,
  isTrackerCredentialVault,
  TRACKER_CREDENTIAL_VAULT_VERSION,
} from "@/lib/tracker-credentials/types"

function validVault(): TrackerCredentialVault {
  return {
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
    ],
  }
}

// ─── isFieldSecret ────────────────────────────────────────────────────────────
//
// A type predicate cannot mutate its input, so "secret defaults to true" is
// satisfied by this accessor rather than by the guard rewriting the object.
// Reading `field.secret` directly would fail OPEN on an absent value.

describe("isFieldSecret", () => {
  it("treats an ABSENT secret flag as secret — fail closed", () => {
    expect(isFieldSecret({})).toBe(true)
  })

  it("treats an explicit undefined as secret", () => {
    expect(isFieldSecret({ secret: undefined })).toBe(true)
  })

  it("returns true for secret: true", () => {
    expect(isFieldSecret({ secret: true })).toBe(true)
  })

  it("returns false ONLY for an explicit secret: false", () => {
    expect(isFieldSecret({ secret: false })).toBe(false)
  })

  it("would fail open if a caller used raw truthiness — this is why the accessor exists", () => {
    const field: { secret?: boolean } = {}
    // The bug this guards against: `undefined` is falsy, so a bare check treats a
    // NickServ password as non-secret and renders it in cleartext.
    expect(Boolean(field.secret)).toBe(false)
    expect(isFieldSecret(field)).toBe(true)
  })
})

// ─── isTrackerCredentialVault: happy paths ────────────────────────────────────

describe("isTrackerCredentialVault — accepts", () => {
  it("accepts a full v1 vault", () => {
    expect(isTrackerCredentialVault(validVault())).toBe(true)
  })

  it("accepts a vault with zero sections (a vault that exists but is empty)", () => {
    expect(isTrackerCredentialVault({ v: 1, sections: [] })).toBe(true)
  })

  it("accepts a section with zero fields", () => {
    expect(
      isTrackerCredentialVault({ v: 1, sections: [{ id: "irc", title: "IRC", fields: [] }] })
    ).toBe(true)
  })

  it("accepts a field with NO secret key at all", () => {
    const vault = {
      v: 1,
      sections: [
        { id: "api", title: "API", fields: [{ id: "api_key", label: "API key", value: "k" }] },
      ],
    }
    expect(isTrackerCredentialVault(vault)).toBe(true)
  })

  it("accepts an empty string value — crypto.ts encrypts empty plaintext by design", () => {
    const vault = {
      v: 1,
      sections: [
        { id: "api", title: "API", fields: [{ id: "api_key", label: "API key", value: "" }] },
      ],
    }
    expect(isTrackerCredentialVault(vault)).toBe(true)
  })

  it("accepts an empty label (shape check only — validate.ts rejects blank labels)", () => {
    const vault = {
      v: 1,
      sections: [{ id: "api", title: "API", fields: [{ id: "api_key", label: "", value: "k" }] }],
    }
    expect(isTrackerCredentialVault(vault)).toBe(true)
  })

  it("TOLERATES unknown extra keys on the vault, section and field", () => {
    // This is the additive-optional-key contract: kind, hint, lastRotatedAt, a
    // section icon and top-level notes must need no migration and no guard change.
    const vault = {
      v: 1,
      notes: "top-level note added by a newer build",
      sections: [
        {
          id: "irc",
          title: "IRC",
          icon: "message-circle",
          fields: [
            {
              id: "irc_nickserv",
              label: "NickServ password",
              value: "hunter2",
              kind: "password",
              hint: "from /msg NickServ",
              lastRotatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      ],
    }
    expect(isTrackerCredentialVault(vault)).toBe(true)
  })
})

// ─── isTrackerCredentialVault: rejections ─────────────────────────────────────

describe("isTrackerCredentialVault — rejects without throwing", () => {
  const nonObjects: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["a number", 1],
    ["a string", "{}"],
    ["a boolean", true],
    ["an array", []],
    ["a JSON string of a valid vault", JSON.stringify(validVault())],
  ]

  for (const [label, input] of nonObjects) {
    it(`rejects ${label}`, () => {
      expect(() => isTrackerCredentialVault(input)).not.toThrow()
      expect(isTrackerCredentialVault(input)).toBe(false)
    })
  }

  it("rejects a missing v", () => {
    expect(isTrackerCredentialVault({ sections: [] })).toBe(false)
  })

  it("rejects a string v of the right value — no coercion", () => {
    expect(isTrackerCredentialVault({ v: "1", sections: [] })).toBe(false)
  })

  it("rejects v: 0", () => {
    expect(isTrackerCredentialVault({ v: 0, sections: [] })).toBe(false)
  })

  it("rejects a FUTURE version — fail closed on a shape this build has never seen", () => {
    expect(isTrackerCredentialVault({ v: 2, sections: [] })).toBe(false)
  })

  it("pins the accepted version to the exported constant", () => {
    expect(TRACKER_CREDENTIAL_VAULT_VERSION).toBe(1)
    expect(isTrackerCredentialVault({ v: TRACKER_CREDENTIAL_VAULT_VERSION, sections: [] })).toBe(
      true
    )
  })

  it("rejects missing sections", () => {
    expect(isTrackerCredentialVault({ v: 1 })).toBe(false)
  })

  it("rejects sections that is an object rather than an array", () => {
    expect(isTrackerCredentialVault({ v: 1, sections: { irc: [] } })).toBe(false)
  })

  it("rejects a null section", () => {
    expect(isTrackerCredentialVault({ v: 1, sections: [null] })).toBe(false)
  })

  it("rejects a section missing id", () => {
    expect(isTrackerCredentialVault({ v: 1, sections: [{ title: "IRC", fields: [] }] })).toBe(false)
  })

  it("rejects a section with an empty-string id", () => {
    expect(
      isTrackerCredentialVault({ v: 1, sections: [{ id: "", title: "IRC", fields: [] }] })
    ).toBe(false)
  })

  it("rejects a section missing title", () => {
    expect(isTrackerCredentialVault({ v: 1, sections: [{ id: "irc", fields: [] }] })).toBe(false)
  })

  it("rejects a section missing fields", () => {
    expect(isTrackerCredentialVault({ v: 1, sections: [{ id: "irc", title: "IRC" }] })).toBe(false)
  })

  it("rejects a section whose fields is not an array", () => {
    expect(
      isTrackerCredentialVault({ v: 1, sections: [{ id: "irc", title: "IRC", fields: {} }] })
    ).toBe(false)
  })

  const badFields: Array<[string, unknown]> = [
    ["a null field", null],
    ["a string field", "api_key"],
    ["a field missing id", { label: "API key", value: "k" }],
    ["a field with an empty id", { id: "", label: "API key", value: "k" }],
    ["a field with a numeric id", { id: 1, label: "API key", value: "k" }],
    ["a field missing label", { id: "api_key", value: "k" }],
    ["a field with a numeric label", { id: "api_key", label: 1, value: "k" }],
    ["a field missing value", { id: "api_key", label: "API key" }],
    ["a field with a null value", { id: "api_key", label: "API key", value: null }],
    ["a field with a numeric value", { id: "api_key", label: "API key", value: 123 }],
    [
      'a field with a STRING secret — no coercion, or "false" would read as secret',
      { id: "api_key", label: "API key", value: "k", secret: "false" },
    ],
    ["a field with a numeric secret", { id: "api_key", label: "API key", value: "k", secret: 0 }],
    ["a field with a null secret", { id: "api_key", label: "API key", value: "k", secret: null }],
  ]

  for (const [label, field] of badFields) {
    it(`rejects ${label}`, () => {
      const vault = { v: 1, sections: [{ id: "api", title: "API", fields: [field] }] }
      expect(() => isTrackerCredentialVault(vault)).not.toThrow()
      expect(isTrackerCredentialVault(vault)).toBe(false)
    })
  }

  it("rejects when ONE section out of several is malformed", () => {
    const vault = {
      v: 1,
      sections: [
        { id: "api", title: "API", fields: [] },
        { id: "irc", title: "IRC", fields: [{ id: "irc_nick", label: "Nick" }] },
      ],
    }
    expect(isTrackerCredentialVault(vault)).toBe(false)
  })
})

// ─── Narrowing ────────────────────────────────────────────────────────────────

describe("isTrackerCredentialVault — narrowing", () => {
  it("narrows unknown to TrackerCredentialVault for the compiler and at runtime", () => {
    const raw: unknown = validVault()
    if (!isTrackerCredentialVault(raw)) throw new Error("guard should have accepted this vault")
    expect(raw.sections[0].fields[1].value).toBe("hunter2")
    expect(isFieldSecret(raw.sections[0].fields[0])).toBe(false)
    expect(isFieldSecret(raw.sections[0].fields[1])).toBe(true)
  })
})
