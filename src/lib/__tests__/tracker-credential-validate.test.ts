// src/lib/__tests__/tracker-credential-validate.test.ts
//
// Functions: validateTrackerCredentialVault, isCredentialSlug, serializedVaultBytes,
//            getDefaultCredentialFields
//
// Every limit is exercised AT its boundary (must pass) and ONE over (must fail),
// using the exported constants rather than hardcoded numbers, so tightening a
// limit updates the test with it instead of leaving a stale duplicate.

import { describe, expect, it } from "vitest"
import {
  getDefaultCredentialFields,
  PLATFORM_CREDENTIAL_FIELDS,
  UNIVERSAL_CREDENTIAL_FIELDS,
} from "@/data/tracker-credential-defaults"
import { TRACKER_REGISTRY } from "@/data/tracker-registry"
import type {
  TrackerCredentialField,
  TrackerCredentialVault,
} from "@/lib/tracker-credentials/types"
import { isFieldSecret } from "@/lib/tracker-credentials/types"
import {
  isCredentialSlug,
  MAX_FIELDS_PER_VAULT,
  MAX_ID_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_SECTIONS,
  MAX_SERIALIZED_BYTES,
  MAX_VALUE_LENGTH,
  serializedVaultBytes,
  validateTrackerCredentialVault,
} from "@/lib/tracker-credentials/validate"

function field(overrides: Partial<TrackerCredentialField> = {}): TrackerCredentialField {
  return { id: "api_key", label: "API key", value: "abc123", ...overrides }
}

function vault(sections: TrackerCredentialVault["sections"]): TrackerCredentialVault {
  return { v: 1, sections }
}

function oneField(overrides: Partial<TrackerCredentialField> = {}): TrackerCredentialVault {
  return vault([{ id: "api", title: "API", fields: [field(overrides)] }])
}

/** Build a vault whose serialized UTF-8 size is EXACTLY `targetBytes`. */
function vaultOfExactBytes(targetBytes: number): TrackerCredentialVault {
  const built = vault([{ id: "api", title: "API", fields: [] }])
  const fields = built.sections[0].fields
  let i = 0
  while (serializedVaultBytes(built) + MAX_VALUE_LENGTH < targetBytes) {
    fields.push({ id: `f${i}`, label: "L", value: "a".repeat(MAX_VALUE_LENGTH) })
    i++
  }
  const before = serializedVaultBytes(built)
  const pad: TrackerCredentialField = { id: `f${i}`, label: "L", value: "" }
  fields.push(pad)
  const overhead = serializedVaultBytes(built) - before
  // All padding is ASCII, so one character is one byte.
  pad.value = "a".repeat(targetBytes - before - overhead)
  return built
}

// ─── isCredentialSlug ─────────────────────────────────────────────────────────

describe("isCredentialSlug", () => {
  const good = ["a", "0", "api_key", "irc-nickserv", "mam_id", "f0", "a".repeat(MAX_ID_LENGTH)]
  for (const s of good) {
    it(`accepts ${JSON.stringify(s.length > 20 ? `${s.slice(0, 8)}… (${s.length})` : s)}`, () => {
      expect(isCredentialSlug(s)).toBe(true)
    })
  }

  const bad: Array<[string, string]> = [
    ["", "empty"],
    ["API_KEY", "uppercase"],
    ["api key", "a space"],
    ["api.key", "a dot"],
    ["api/key", "a slash — would break a URL-keyed reveal"],
    ["_api", "a leading underscore"],
    ["-api", "a leading hyphen — could read as a flag"],
    ["api:key", "a colon"],
    ["ápi", "a non-ASCII letter"],
    ["api\nkey", "a newline"],
    ["a".repeat(MAX_ID_LENGTH + 1), "one character over the id limit"],
  ]
  for (const [s, why] of bad) {
    it(`rejects ${why}`, () => {
      expect(isCredentialSlug(s)).toBe(false)
    })
  }
})

// ─── Shape rejection is delegated to the guard ────────────────────────────────

describe("validateTrackerCredentialVault — shape", () => {
  it("accepts a minimal valid vault", () => {
    expect(validateTrackerCredentialVault(oneField())).toBeNull()
  })

  it("accepts an empty vault", () => {
    expect(validateTrackerCredentialVault({ v: 1, sections: [] })).toBeNull()
  })

  for (const [label, input] of [
    ["null", null],
    ["undefined", undefined],
    ["a string", "not a vault"],
    ["an array", []],
    ["a missing version", { sections: [] }],
    ["a future version", { v: 2, sections: [] }],
    ["missing sections", { v: 1 }],
    ["a malformed field", { v: 1, sections: [{ id: "api", title: "API", fields: [{ id: "x" }] }] }],
  ] as Array<[string, unknown]>) {
    it(`rejects ${label} with the version-and-sections message`, () => {
      expect(validateTrackerCredentialVault(input)).toMatch(
        /version 1 object with a sections array/
      )
    })
  }
})

// ─── Section count ────────────────────────────────────────────────────────────

describe("validateTrackerCredentialVault — MAX_SECTIONS", () => {
  const sectionsOf = (n: number) =>
    vault(Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `S${i}`, fields: [] })))

  it(`accepts exactly ${MAX_SECTIONS} sections`, () => {
    expect(validateTrackerCredentialVault(sectionsOf(MAX_SECTIONS))).toBeNull()
  })

  it(`rejects ${MAX_SECTIONS + 1} sections`, () => {
    expect(validateTrackerCredentialVault(sectionsOf(MAX_SECTIONS + 1))).toMatch(
      /Too many sections/
    )
  })
})

// ─── Field count (vault-wide, not per section) ────────────────────────────────

describe("validateTrackerCredentialVault — MAX_FIELDS_PER_VAULT", () => {
  /** Spread n fields over two sections, proving the cap is vault-wide. */
  const fieldsOf = (n: number) => {
    const all = Array.from({ length: n }, (_, i) => field({ id: `f${i}`, label: `F${i}` }))
    const half = Math.ceil(n / 2)
    return vault([
      { id: "a", title: "A", fields: all.slice(0, half) },
      { id: "b", title: "B", fields: all.slice(half) },
    ])
  }

  it(`accepts exactly ${MAX_FIELDS_PER_VAULT} fields across sections`, () => {
    expect(validateTrackerCredentialVault(fieldsOf(MAX_FIELDS_PER_VAULT))).toBeNull()
  })

  it(`rejects ${MAX_FIELDS_PER_VAULT + 1} fields across sections`, () => {
    expect(validateTrackerCredentialVault(fieldsOf(MAX_FIELDS_PER_VAULT + 1))).toMatch(
      /Too many fields/
    )
  })
})

// ─── Label and title length ───────────────────────────────────────────────────

describe("validateTrackerCredentialVault — MAX_LABEL_LENGTH", () => {
  it(`accepts a label of exactly ${MAX_LABEL_LENGTH}`, () => {
    expect(
      validateTrackerCredentialVault(oneField({ label: "a".repeat(MAX_LABEL_LENGTH) }))
    ).toBeNull()
  })

  it("rejects a label one character over", () => {
    expect(
      validateTrackerCredentialVault(oneField({ label: "a".repeat(MAX_LABEL_LENGTH + 1) }))
    ).toMatch(/Label for "api_key" is too long/)
  })

  it("rejects a blank label", () => {
    expect(validateTrackerCredentialVault(oneField({ label: "   " }))).toMatch(/needs a label/)
  })

  it(`accepts a section title of exactly ${MAX_LABEL_LENGTH}`, () => {
    const v = vault([{ id: "api", title: "a".repeat(MAX_LABEL_LENGTH), fields: [] }])
    expect(validateTrackerCredentialVault(v)).toBeNull()
  })

  it("rejects a section title one character over", () => {
    const v = vault([{ id: "api", title: "a".repeat(MAX_LABEL_LENGTH + 1), fields: [] }])
    expect(validateTrackerCredentialVault(v)).toMatch(/Section title for "api" is too long/)
  })

  it("rejects a blank section title", () => {
    expect(validateTrackerCredentialVault(vault([{ id: "api", title: "", fields: [] }]))).toMatch(
      /needs a title/
    )
  })
})

// ─── Value length ─────────────────────────────────────────────────────────────

describe("validateTrackerCredentialVault — MAX_VALUE_LENGTH", () => {
  it(`accepts a value of exactly ${MAX_VALUE_LENGTH}`, () => {
    expect(
      validateTrackerCredentialVault(oneField({ value: "a".repeat(MAX_VALUE_LENGTH) }))
    ).toBeNull()
  })

  it("rejects a value one character over", () => {
    expect(
      validateTrackerCredentialVault(oneField({ value: "a".repeat(MAX_VALUE_LENGTH + 1) }))
    ).toMatch(/Value for "API key" is too long/)
  })

  it("ACCEPTS an empty value — crypto.ts encrypts empty plaintext and the re-key path depends on it", () => {
    expect(validateTrackerCredentialVault(oneField({ value: "" }))).toBeNull()
  })
})

// ─── Total serialized size ────────────────────────────────────────────────────

describe("validateTrackerCredentialVault — MAX_SERIALIZED_BYTES", () => {
  it("builds the boundary fixture to the exact byte", () => {
    expect(serializedVaultBytes(vaultOfExactBytes(MAX_SERIALIZED_BYTES))).toBe(MAX_SERIALIZED_BYTES)
  })

  it(`accepts a vault of exactly ${MAX_SERIALIZED_BYTES} bytes`, () => {
    expect(validateTrackerCredentialVault(vaultOfExactBytes(MAX_SERIALIZED_BYTES))).toBeNull()
  })

  it("rejects a vault one byte over", () => {
    expect(validateTrackerCredentialVault(vaultOfExactBytes(MAX_SERIALIZED_BYTES + 1))).toMatch(
      /Credential vault is too large/
    )
  })

  it("counts UTF-8 BYTES, not JS string length — multi-byte values cannot smuggle past the cap", () => {
    // "€" is one UTF-16 code unit but three UTF-8 bytes.
    const v = oneField({ value: "€" })
    expect(serializedVaultBytes(v)).toBe(JSON.stringify(v).length + 2)
  })
})

// ─── Id uniqueness and slug rules ─────────────────────────────────────────────

describe("validateTrackerCredentialVault — ids", () => {
  it("rejects a duplicate field id WITHIN a section", () => {
    const v = vault([
      { id: "api", title: "API", fields: [field({ id: "api_key" }), field({ id: "api_key" })] },
    ])
    expect(validateTrackerCredentialVault(v)).toMatch(
      /Duplicate field id "api_key"\. Field ids must be unique across the whole vault/
    )
  })

  it("rejects a duplicate field id ACROSS sections — the reveal endpoint keys on id alone", () => {
    const v = vault([
      { id: "api", title: "API", fields: [field({ id: "api_key" })] },
      { id: "rss", title: "RSS", fields: [field({ id: "api_key" })] },
    ])
    expect(validateTrackerCredentialVault(v)).toMatch(/unique across the whole vault/)
  })

  it("rejects a duplicate section id", () => {
    const v = vault([
      { id: "api", title: "API", fields: [] },
      { id: "api", title: "API again", fields: [] },
    ])
    expect(validateTrackerCredentialVault(v)).toMatch(/Duplicate section id "api"/)
  })

  it("allows a field id that matches a SECTION id — the two namespaces are separate", () => {
    const v = vault([{ id: "api", title: "API", fields: [field({ id: "api" })] }])
    expect(validateTrackerCredentialVault(v)).toBeNull()
  })

  it("rejects a non-slug field id", () => {
    expect(validateTrackerCredentialVault(oneField({ id: "API Key" }))).toMatch(
      /Field id "API Key" must be a slug/
    )
  })

  it("TRUNCATES a huge rejected id instead of echoing it — the error path is a DoS surface too", () => {
    // The slug check fires before any length check, so without truncation a 1 MB
    // id would come straight back to the caller inside a 1 MB error string.
    const huge = "A".repeat(1_000_000)
    const message = validateTrackerCredentialVault(oneField({ id: huge }))
    expect(message).toMatch(/must be a slug/)
    expect(message?.length ?? 0).toBeLessThan(500)
    expect(message).not.toContain(huge)
  })

  it("truncates a huge rejected SECTION id as well", () => {
    const huge = "A".repeat(1_000_000)
    const message = validateTrackerCredentialVault(vault([{ id: huge, title: "T", fields: [] }]))
    expect(message).toMatch(/must be a slug/)
    expect(message?.length ?? 0).toBeLessThan(500)
  })

  it("leaves a short id fully intact in the message", () => {
    expect(validateTrackerCredentialVault(oneField({ id: "Bad Id" }))).toContain('"Bad Id"')
  })

  it("rejects a non-slug section id", () => {
    const v = vault([{ id: "My Section", title: "T", fields: [] }])
    expect(validateTrackerCredentialVault(v)).toMatch(/Section id "My Section" must be a slug/)
  })

  it(`accepts ids of exactly ${MAX_ID_LENGTH} characters and rejects one over`, () => {
    expect(validateTrackerCredentialVault(oneField({ id: "a".repeat(MAX_ID_LENGTH) }))).toBeNull()
    expect(validateTrackerCredentialVault(oneField({ id: "a".repeat(MAX_ID_LENGTH + 1) }))).toMatch(
      /must be a slug/
    )
  })
})

// ─── secret defaulting survives validation ────────────────────────────────────

describe("validateTrackerCredentialVault — secret flag", () => {
  it("accepts a field with no secret key and leaves it absent (fail closed on read)", () => {
    const v = oneField()
    expect(validateTrackerCredentialVault(v)).toBeNull()
    expect(v.sections[0].fields[0].secret).toBeUndefined()
    expect(isFieldSecret(v.sections[0].fields[0])).toBe(true)
  })

  it("accepts explicit secret: false", () => {
    expect(validateTrackerCredentialVault(oneField({ secret: false }))).toBeNull()
  })

  it("does not mutate the input vault", () => {
    const v = oneField()
    const snapshot = JSON.stringify(v)
    validateTrackerCredentialVault(v)
    expect(JSON.stringify(v)).toBe(snapshot)
  })
})

// ─── Registry defaults cross-check ────────────────────────────────────────────
//
// Catches drift between the committed default definitions and the validator: a
// default whose id is not a slug would produce a vault that cannot be saved.

describe("registry credential defaults", () => {
  const allDefinitionLists: ReadonlyArray<
    readonly [string, readonly { id: string; label: string }[]]
  > = [
    ["universal fallback", UNIVERSAL_CREDENTIAL_FIELDS],
    ...Object.entries(PLATFORM_CREDENTIAL_FIELDS).map(
      ([platform, fields]) => [`platform ${platform}`, fields ?? []] as const
    ),
    ...TRACKER_REGISTRY.filter((t) => t.credentialFields).map(
      (t) => [`tracker ${t.slug}`, t.credentialFields ?? []] as const
    ),
  ]

  for (const [label, fields] of allDefinitionLists) {
    it(`${label}: every id is a valid slug, unique, with a bounded non-empty label`, () => {
      const seen = new Set<string>()
      for (const f of fields) {
        expect(isCredentialSlug(f.id), `${label} id ${JSON.stringify(f.id)}`).toBe(true)
        expect(seen.has(f.id), `${label} duplicate id ${f.id}`).toBe(false)
        seen.add(f.id)
        expect(f.label.trim().length).toBeGreaterThan(0)
        expect(f.label.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH)
      }
    })

    it(`${label}: no definition carries a value — public git data must never hold secrets`, () => {
      for (const f of fields) {
        expect(Object.hasOwn(f, "value")).toBe(false)
      }
    })

    it(`${label}: is small enough to seed a savable vault`, () => {
      expect(fields.length).toBeLessThanOrEqual(MAX_FIELDS_PER_VAULT)
    })
  }

  it("every registry entry resolves to a non-empty default list", () => {
    for (const entry of TRACKER_REGISTRY) {
      expect(getDefaultCredentialFields(entry).length, entry.slug).toBeGreaterThan(0)
    }
  })

  it("falls back to the universal API key field for an unmapped platform", () => {
    expect(getDefaultCredentialFields({ platform: "custom" })).toBe(UNIVERSAL_CREDENTIAL_FIELDS)
    expect(UNIVERSAL_CREDENTIAL_FIELDS.map((f) => f.id)).toEqual(["api_key"])
  })

  it("prefers the platform list over the universal fallback", () => {
    expect(getDefaultCredentialFields({ platform: "unit3d" })).toBe(
      PLATFORM_CREDENTIAL_FIELDS.unit3d
    )
  })

  it("prefers a per-tracker override over the platform list, without merging", () => {
    const override = [{ id: "only_this", label: "Only this" }]
    expect(getDefaultCredentialFields({ platform: "unit3d", credentialFields: override })).toBe(
      override
    )
  })

  it("defaults treat an IRC nick as non-secret and a NickServ password as secret", () => {
    const gazelle = PLATFORM_CREDENTIAL_FIELDS.gazelle ?? []
    const nick = gazelle.find((f) => f.id === "irc_nick")
    const nickserv = gazelle.find((f) => f.id === "irc_nickserv")
    expect(nick && isFieldSecret(nick)).toBe(false)
    expect(nickserv && isFieldSecret(nickserv)).toBe(true)
    expect(nickserv?.secret).toBeUndefined()
  })

  it("a vault seeded from any platform default passes validation", () => {
    for (const [platform, fields] of Object.entries(PLATFORM_CREDENTIAL_FIELDS)) {
      const seeded = vault([
        {
          id: "general",
          title: "General",
          fields: (fields ?? []).map((f) => ({ ...f, value: "" })),
        },
      ])
      expect(validateTrackerCredentialVault(seeded), platform).toBeNull()
    }
  })
})
