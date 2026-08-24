// src/lib/__tests__/tracker-credential-draft.test.ts
//
// The sheet's editing rules, tested without rendering anything.
//
// The rule worth the most here is the three-way distinction a draft field can be
// in, HELD (`value: "abc"`), HELD-AND-EMPTY (`value: ""`), and NOT HELD
// (`value: null`), and that only the last one serializes to an omitted `value`.
// Collapse any two of those and either secrets get wiped on every edit or the
// Clear button stops working.

import { describe, expect, it } from "vitest"
import {
  type DraftVault,
  draftFromView,
  draftToInput,
  draftToValidationVault,
  isDraftDirty,
  newDraftField,
  newDraftSection,
  slugifyCredentialId,
} from "@/lib/tracker-credentials/draft"
import {
  isCredentialSlug,
  validateTrackerCredentialVault,
} from "@/lib/tracker-credentials/validate"
import type { TrackerCredentialVaultView } from "@/lib/tracker-credentials/view"

const VIEW: TrackerCredentialVaultView = {
  v: 1,
  sections: [
    {
      id: "irc",
      title: "IRC",
      fields: [
        { id: "irc_nick", label: "Nick", secret: false, value: "jordy" },
        { id: "irc_nickserv", label: "NickServ password", secret: true, hasValue: true },
        { id: "unset", label: "Unset", secret: true, hasValue: false },
      ],
    },
  ],
}

const DEFAULTS = [
  { id: "api_key", label: "API key" },
  { id: "irc_nick", label: "IRC nick", secret: false },
]

describe("slugifyCredentialId", () => {
  it("produces ids the validator accepts", () => {
    for (const label of ["API key", "NickServ Password", "RSS feed URL", "mam_id session cookie"]) {
      const slug = slugifyCredentialId(label)
      expect(isCredentialSlug(slug)).toBe(true)
    }
  })

  it("returns EMPTY when nothing usable survives, rather than an invalid slug", () => {
    // The caller has to supply a fallback. Inventing one here would hide the
    // case and eventually emit an id the validator rejects.
    expect(slugifyCredentialId("!!!")).toBe("")
    expect(slugifyCredentialId("日本語")).toBe("")
    expect(slugifyCredentialId("")).toBe("")
  })

  it("never emits a leading separator, which the slug rule forbids", () => {
    expect(slugifyCredentialId("  -- hello")).toBe("hello")
    expect(slugifyCredentialId("_leading")).toBe("leading")
  })

  it("stays inside the id length bound", () => {
    const slug = slugifyCredentialId("a".repeat(500))
    expect(slug.length).toBeLessThanOrEqual(64)
    expect(isCredentialSlug(slug)).toBe(true)
  })
})

describe("draftFromView", () => {
  it("holds NOTHING for a stored secret", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    const nickserv = draft.sections[0].fields[1]
    // null, not "". This is what keeps the value out of the next PUT.
    expect(nickserv.value).toBeNull()
    expect(nickserv.shown).toBe(false)
    expect(nickserv.hasStoredValue).toBe(true)
  })

  it("holds the value of a field marked public", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    expect(draft.sections[0].fields[0]).toMatchObject({ value: "jordy", shown: true })
  })

  it("distinguishes a stored-but-empty secret from a stored one", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    // Drives the placeholder: "•••• (stored)" versus "Not set".
    expect(draft.sections[0].fields[2].hasStoredValue).toBe(false)
  })

  it("seeds from the registry defaults ONLY when there is no vault", () => {
    const seeded = draftFromView(null, DEFAULTS)
    expect(seeded.sections).toHaveLength(1)
    expect(seeded.sections[0].title).toBe("Credentials")
    expect(seeded.sections[0].fields.map((f) => f.id)).toEqual(["api_key", "irc_nick"])
  })

  it("IGNORES the defaults entirely once a vault exists — the user's data wins", () => {
    // The documented policy. A later change to the registry must not resurrect a
    // field the user deleted, nor overwrite a label they renamed.
    const draft = draftFromView(VIEW, DEFAULTS)
    expect(draft.sections[0].fields.map((f) => f.id)).toEqual(["irc_nick", "irc_nickserv", "unset"])
    expect(draft.sections.flatMap((s) => s.fields).some((f) => f.id === "api_key")).toBe(false)
  })

  it("applies the fail-closed secret default when a definition omits the flag", () => {
    const seeded = draftFromView(null, DEFAULTS)
    // `api_key` has no `secret` key; absent means secret.
    expect(seeded.sections[0].fields[0].secret).toBe(true)
    expect(seeded.sections[0].fields[1].secret).toBe(false)
  })
})

describe("draftToInput", () => {
  it("OMITS the value key for a field the client does not hold", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    const field = draftToInput(draft).sections[0].fields[1]
    expect(field).not.toHaveProperty("value")
  })

  it("sends an explicit empty string for a field the user cleared", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    draft.sections[0].fields[1].value = ""
    expect(draftToInput(draft).sections[0].fields[1].value).toBe("")
  })

  it("always states `secret` explicitly", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    for (const field of draftToInput(draft).sections[0].fields) {
      // The server takes `secret` from the input alone, so omitting it would
      // silently re-secret a field the user had made public.
      expect(typeof field.secret).toBe("boolean")
    }
  })

  it("derives an id for a new field from its label", () => {
    const draft: DraftVault = { sections: [newDraftSection("Announce")] }
    draft.sections[0].fields.push({ ...newDraftField("Announce URL", false) })
    const input = draftToInput(draft)
    expect(input.sections[0].id).toBe("announce")
    expect(input.sections[0].fields[0].id).toBe("announce_url")
  })

  it("falls back to a generic id when the label slugifies to nothing", () => {
    const draft: DraftVault = { sections: [newDraftSection("!!!")] }
    draft.sections[0].fields.push(newDraftField("日本語"))
    const input = draftToInput(draft)
    expect(isCredentialSlug(input.sections[0].id)).toBe(true)
    expect(isCredentialSlug(input.sections[0].fields[0].id)).toBe(true)
  })

  it("never derives an id that collides with one already stored", () => {
    // A duplicate id would make the reveal endpoint's section-blind lookup
    // ambiguous and could hand back the wrong secret.
    const draft = draftFromView(VIEW, DEFAULTS)
    draft.sections[0].fields.push(newDraftField("Nick"))
    const ids = draftToInput(draft).sections[0].fields.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain("irc_nick")
  })

  it("does not collide two new fields with the same label against each other", () => {
    const draft: DraftVault = { sections: [newDraftSection("S")] }
    draft.sections[0].fields.push(newDraftField("API key"), newDraftField("API key"))
    const ids = draftToInput(draft).sections[0].fields.map((f) => f.id)
    expect(new Set(ids).size).toBe(2)
  })

  it("FREEZES an id that is already stored, even when the label changes", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    draft.sections[0].fields[1].label = "Completely different name"
    // The id is the key the reveal endpoint resolves on. Renaming a label must
    // never move it, or the stored value becomes unreachable.
    expect(draftToInput(draft).sections[0].fields[1].id).toBe("irc_nickserv")
  })

  it("trims labels and titles so trailing spaces cannot fake a valid label", () => {
    const draft: DraftVault = { sections: [newDraftSection("  Spaced  ")] }
    draft.sections[0].fields.push(newDraftField("  Field  "))
    const input = draftToInput(draft)
    expect(input.sections[0].title).toBe("Spaced")
    expect(input.sections[0].fields[0].label).toBe("Field")
  })
})

describe("draftToValidationVault", () => {
  it("produces something the real validator accepts", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    expect(validateTrackerCredentialVault(draftToValidationVault(draft))).toBeNull()
  })

  it("catches a blank label before any round trip", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    draft.sections[0].fields[0].label = "   "
    expect(validateTrackerCredentialVault(draftToValidationVault(draft))).toMatch(/needs a label/)
  })

  it("catches a blank section title", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    draft.sections[0].title = ""
    expect(validateTrackerCredentialVault(draftToValidationVault(draft))).toMatch(/needs a title/)
  })

  it("substitutes empty for values the client does not hold", () => {
    // Which makes the SIZE limits an under-estimate here. That is deliberate and
    // documented: the server re-validates the merged vault, and that check is
    // the authoritative one.
    const draft = draftFromView(VIEW, DEFAULTS)
    const vault = draftToValidationVault(draft)
    expect(vault.sections[0].fields[1].value).toBe("")
  })
})

describe("isDraftDirty", () => {
  it("is false for an untouched draft", () => {
    const draft = draftFromView(VIEW, DEFAULTS)
    expect(isDraftDirty(draft, draftFromView(VIEW, DEFAULTS))).toBe(false)
  })

  it("is false for a freshly seeded default vault", () => {
    // Opening a sheet the user has not touched must not prompt them to discard
    // changes the app invented on their behalf.
    const seeded = draftFromView(null, DEFAULTS)
    expect(isDraftDirty(seeded, seeded)).toBe(false)
  })

  it("IGNORES `shown`, so looking at a secret is not an edit", () => {
    const original = draftFromView(VIEW, DEFAULTS)
    const current = draftFromView(VIEW, DEFAULTS)
    current.sections[0].fields[1].shown = true
    expect(isDraftDirty(current, original)).toBe(false)
  })

  it("notices a changed label, title, order, or value", () => {
    const original = draftFromView(VIEW, DEFAULTS)

    const relabelled = draftFromView(VIEW, DEFAULTS)
    relabelled.sections[0].fields[0].label = "Nickname"
    expect(isDraftDirty(relabelled, original)).toBe(true)

    const retitled = draftFromView(VIEW, DEFAULTS)
    retitled.sections[0].title = "Chat"
    expect(isDraftDirty(retitled, original)).toBe(true)

    const revalued = draftFromView(VIEW, DEFAULTS)
    revalued.sections[0].fields[1].value = "new-secret"
    expect(isDraftDirty(revalued, original)).toBe(true)

    const reordered = draftFromView(VIEW, DEFAULTS)
    reordered.sections[0].fields.reverse()
    expect(isDraftDirty(reordered, original)).toBe(true)
  })

  it("treats holding an empty value as different from holding nothing", () => {
    // The Clear button's entire effect lives in this distinction.
    const original = draftFromView(VIEW, DEFAULTS)
    const cleared = draftFromView(VIEW, DEFAULTS)
    cleared.sections[0].fields[1].value = ""
    expect(isDraftDirty(cleared, original)).toBe(true)
  })
})
