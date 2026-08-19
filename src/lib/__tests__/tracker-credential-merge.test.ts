// src/lib/__tests__/tracker-credential-merge.test.ts
//
// Unit coverage for the merge that lets a MASKED sheet write a WHOLE vault.
//
// The route tests cover the same ground end-to-end through real crypto; these
// pin the semantics directly, so a regression names the rule it broke instead of
// just reddening "PUT preserves secrets".

import { describe, expect, it } from "vitest"
import {
  isTrackerCredentialVaultInput,
  mergeVaultInput,
} from "@/lib/tracker-credentials/merge"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"

const STORED: TrackerCredentialVault = {
  v: 1,
  sections: [
    {
      id: "irc",
      title: "IRC",
      fields: [
        { id: "irc_nick", label: "Nick", value: "jordy", secret: false },
        { id: "irc_nickserv", label: "NickServ password", value: "hunter2" },
      ],
    },
    {
      id: "rss",
      title: "RSS",
      fields: [{ id: "passkey", label: "Passkey", value: "pk-123", secret: true }],
    },
  ],
}

describe("isTrackerCredentialVaultInput", () => {
  it("accepts a field with no `value` — that is the whole point of the shape", () => {
    expect(
      isTrackerCredentialVaultInput({
        v: 1,
        sections: [{ id: "a", title: "A", fields: [{ id: "f", label: "F" }] }],
      })
    ).toBe(true)
  })

  it("accepts an explicit empty string, which means something different", () => {
    expect(
      isTrackerCredentialVaultInput({
        v: 1,
        sections: [{ id: "a", title: "A", fields: [{ id: "f", label: "F", value: "" }] }],
      })
    ).toBe(true)
  })

  it("rejects a non-string value rather than letting it be coerced downstream", () => {
    for (const bad of [null, 0, 1, [], {}, true]) {
      expect(
        isTrackerCredentialVaultInput({
          v: 1,
          sections: [{ id: "a", title: "A", fields: [{ id: "f", label: "F", value: bad }] }],
        })
      ).toBe(false)
    }
  })

  it("rejects a non-boolean `secret`, so no string 'false' sneaks past isFieldSecret", () => {
    expect(
      isTrackerCredentialVaultInput({
        v: 1,
        sections: [{ id: "a", title: "A", fields: [{ id: "f", label: "F", secret: "false" }] }],
      })
    ).toBe(false)
  })

  it("pins the version and fails closed on an unknown one", () => {
    expect(isTrackerCredentialVaultInput({ v: 2, sections: [] })).toBe(false)
    expect(isTrackerCredentialVaultInput({ v: "1", sections: [] })).toBe(false)
  })

  it("tolerates unknown extra keys so additive fields round-trip", () => {
    expect(
      isTrackerCredentialVaultInput({
        v: 1,
        notes: "top-level",
        sections: [
          { id: "a", title: "A", icon: "x", fields: [{ id: "f", label: "F", kind: "url" }] },
        ],
      })
    ).toBe(true)
  })

  it("never throws on hostile input", () => {
    for (const bad of [null, undefined, 0, "", [], "string", { v: 1 }, { sections: [] }]) {
      expect(() => isTrackerCredentialVaultInput(bad)).not.toThrow()
      expect(isTrackerCredentialVaultInput(bad)).toBe(false)
    }
  })
})

describe("mergeVaultInput", () => {
  it("carries the stored value forward when the input omits it", () => {
    const merged = mergeVaultInput(
      {
        v: 1,
        sections: [
          { id: "irc", title: "IRC", fields: [{ id: "irc_nickserv", label: "NickServ password" }] },
        ],
      },
      STORED
    )
    expect(merged.sections[0].fields[0].value).toBe("hunter2")
  })

  it("distinguishes an omitted value from an empty one", () => {
    // If these two ever produce the same result, the Clear button is broken in
    // one direction or the rename path destroys secrets in the other.
    const kept = mergeVaultInput(
      { v: 1, sections: [{ id: "rss", title: "R", fields: [{ id: "passkey", label: "P" }] }] },
      STORED
    )
    const cleared = mergeVaultInput(
      {
        v: 1,
        sections: [{ id: "rss", title: "R", fields: [{ id: "passkey", label: "P", value: "" }] }],
      },
      STORED
    )
    expect(kept.sections[0].fields[0].value).toBe("pk-123")
    expect(cleared.sections[0].fields[0].value).toBe("")
  })

  it("defaults an unknown field id to empty rather than to some neighbour", () => {
    const merged = mergeVaultInput(
      { v: 1, sections: [{ id: "new", title: "New", fields: [{ id: "brand_new", label: "N" }] }] },
      STORED
    )
    expect(merged.sections[0].fields[0].value).toBe("")
  })

  it("treats a null `existing` — no vault yet — as all-empty", () => {
    const merged = mergeVaultInput(
      { v: 1, sections: [{ id: "a", title: "A", fields: [{ id: "api_key", label: "API key" }] }] },
      null
    )
    expect(merged.sections[0].fields[0].value).toBe("")
  })

  it("takes `secret` from the INPUT only, never from the stored field", () => {
    // Fail-closed direction: an input that omits the flag means secret. If the
    // stored `secret: false` leaked through, a field the user just marked secret
    // would keep rendering its plaintext in the sheet.
    const merged = mergeVaultInput(
      { v: 1, sections: [{ id: "irc", title: "IRC", fields: [{ id: "irc_nick", label: "N" }] }] },
      STORED
    )
    expect(merged.sections[0].fields[0].secret).toBeUndefined()
  })

  it("honours an explicit secret: false on the input", () => {
    const merged = mergeVaultInput(
      {
        v: 1,
        sections: [
          { id: "rss", title: "R", fields: [{ id: "passkey", label: "P", secret: false }] },
        ],
      },
      STORED
    )
    expect(merged.sections[0].fields[0].secret).toBe(false)
  })

  it("finds a stored value by id across section boundaries", () => {
    const merged = mergeVaultInput(
      { v: 1, sections: [{ id: "irc", title: "IRC", fields: [{ id: "passkey", label: "P" }] }] },
      STORED
    )
    expect(merged.sections[0].fields[0].value).toBe("pk-123")
  })

  it("preserves array order, because array order IS display order", () => {
    const merged = mergeVaultInput(
      {
        v: 1,
        sections: [
          { id: "rss", title: "RSS", fields: [{ id: "passkey", label: "P" }] },
          { id: "irc", title: "IRC", fields: [{ id: "irc_nickserv", label: "N" }] },
        ],
      },
      STORED
    )
    expect(merged.sections.map((s) => s.id)).toEqual(["rss", "irc"])
  })

  it("drops a section the user deleted", () => {
    const merged = mergeVaultInput(
      { v: 1, sections: [{ id: "irc", title: "IRC", fields: [] }] },
      STORED
    )
    expect(merged.sections).toHaveLength(1)
    expect(merged.sections[0].fields).toHaveLength(0)
  })

  it("carries unknown additive keys through an edit instead of stripping them", () => {
    // The `v` contract says additive optional keys need no migration. A sheet
    // round-trip is where they would quietly disappear, because the view layer
    // drops them on the way out — so the merge has to put them back.
    const storedWithExtras = {
      v: 1,
      notes: "vault note",
      sections: [
        {
          id: "rss",
          title: "RSS",
          icon: "rss-icon",
          fields: [{ id: "passkey", label: "Passkey", value: "pk-123", lastRotatedAt: "2026-01-01" }],
        },
      ],
    } as unknown as TrackerCredentialVault

    const merged = mergeVaultInput(
      { v: 1, sections: [{ id: "rss", title: "Renamed", fields: [{ id: "passkey", label: "P" }] }] },
      storedWithExtras
    ) as unknown as Record<string, unknown>

    expect(merged.notes).toBe("vault note")
    const section = (merged.sections as Record<string, unknown>[])[0]
    expect(section.icon).toBe("rss-icon")
    expect(section.title).toBe("Renamed")
    expect((section.fields as Record<string, unknown>[])[0].lastRotatedAt).toBe("2026-01-01")
  })

  it("always produces version 1, whatever the input claimed", () => {
    const merged = mergeVaultInput({ v: 1, sections: [] }, null)
    expect(merged.v).toBe(1)
  })
})
