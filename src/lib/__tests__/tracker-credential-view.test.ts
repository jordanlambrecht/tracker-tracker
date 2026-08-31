// src/lib/__tests__/tracker-credential-view.test.ts
//
// toVaultView is the boundary that keeps secret plaintext out of the read
// response, and consumeRevealToken bounds the one endpoint that hands plaintext
// back. Both are pure enough to test without a route around them, which is the
// point of extracting them.

import { beforeEach, describe, expect, it } from "vitest"
import {
  consumeRevealToken,
  REVEAL_MAX_PER_WINDOW,
  REVEAL_WINDOW_MS,
  resetRevealLimit,
} from "@/lib/tracker-credentials/reveal-limit"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"
import { toVaultView } from "@/lib/tracker-credentials/view"

function vault(fields: TrackerCredentialVault["sections"][number]["fields"]) {
  return { v: 1, sections: [{ id: "s", title: "S", fields }] }
}

describe("toVaultView", () => {
  it("drops the `value` property from a secret field entirely", () => {
    const view = toVaultView(vault([{ id: "k", label: "Key", value: "s3cret", secret: true }]))
    const field = view.sections[0].fields[0]
    expect(field).not.toHaveProperty("value")
    expect(JSON.stringify(view)).not.toContain("s3cret")
  })

  it("treats `secret` ABSENT as secret — the fail-closed default", () => {
    // This is the whole reason isFieldSecret() exists. `Boolean(field.secret)`
    // on an absent flag is false, which would render a NickServ password in
    // cleartext; the accessor inverts that to fail closed.
    const view = toVaultView(vault([{ id: "k", label: "Key", value: "s3cret" }]))
    const field = view.sections[0].fields[0]
    expect(field.secret).toBe(true)
    expect(field).not.toHaveProperty("value")
    expect(JSON.stringify(view)).not.toContain("s3cret")
  })

  it("keeps the value only when `secret` is literally false", () => {
    const view = toVaultView(vault([{ id: "n", label: "Nick", value: "jordy", secret: false }]))
    expect(view.sections[0].fields[0]).toEqual({
      id: "n",
      label: "Nick",
      secret: false,
      value: "jordy",
    })
  })

  it("reports hasValue as a boolean, never a length", () => {
    const view = toVaultView(
      vault([
        { id: "a", label: "A", value: "" },
        { id: "b", label: "B", value: "xyz" },
      ])
    )
    // A length would be a plaintext oracle for short secrets.
    expect(view.sections[0].fields[0]).toMatchObject({ hasValue: false })
    expect(view.sections[0].fields[1]).toMatchObject({ hasValue: true })
  })

  it("does not echo unknown extra keys to the client", () => {
    // Unknown additive keys round-trip through STORAGE untouched, that is the
    // no-migration contract, but they have no business on the wire, and a
    // future key holding something sensitive must not leak by default.
    const withExtras = {
      v: 1,
      sections: [
        {
          id: "s",
          title: "S",
          icon: "irc",
          fields: [{ id: "k", label: "Key", value: "s3cret", hint: "somewhere", kind: "password" }],
        },
      ],
    } as unknown as TrackerCredentialVault

    const view = toVaultView(withExtras)
    expect(view.sections[0]).not.toHaveProperty("icon")
    expect(view.sections[0].fields[0]).not.toHaveProperty("hint")
    expect(view.sections[0].fields[0]).not.toHaveProperty("kind")
  })

  it("preserves array order — array order IS display order", () => {
    const view = toVaultView(
      vault([
        { id: "one", label: "1", value: "", secret: false },
        { id: "two", label: "2", value: "", secret: false },
        { id: "three", label: "3", value: "", secret: false },
      ])
    )
    expect(view.sections[0].fields.map((f) => f.id)).toEqual(["one", "two", "three"])
  })
})

describe("consumeRevealToken", () => {
  beforeEach(() => resetRevealLimit())

  it("allows exactly the budget, then blocks", () => {
    const t = 1_000_000
    for (let i = 0; i < REVEAL_MAX_PER_WINDOW; i++) {
      expect(consumeRevealToken(t)).toBeNull()
    }
    expect(consumeRevealToken(t)).not.toBeNull()
  })

  it("resets on the next fixed window", () => {
    const t = 1_000_000
    for (let i = 0; i < REVEAL_MAX_PER_WINDOW; i++) consumeRevealToken(t)
    expect(consumeRevealToken(t + REVEAL_WINDOW_MS - 1)).not.toBeNull()
    expect(consumeRevealToken(t + REVEAL_WINDOW_MS)).toBeNull()
  })

  it("does not extend the window when a call is rejected", () => {
    const t = 1_000_000
    for (let i = 0; i < REVEAL_MAX_PER_WINDOW; i++) consumeRevealToken(t)
    // A fixed window, not a sliding penalty: hammering it must not push the
    // reset further out, or a client that backs off never recovers.
    consumeRevealToken(t + 10)
    consumeRevealToken(t + 20)
    expect(consumeRevealToken(t + REVEAL_WINDOW_MS)).toBeNull()
  })

  it("reports a positive retry delay", () => {
    const t = 1_000_000
    for (let i = 0; i < REVEAL_MAX_PER_WINDOW; i++) consumeRevealToken(t)
    const wait = consumeRevealToken(t)
    expect(wait).toBeGreaterThan(0)
    expect(wait).toBeLessThanOrEqual(REVEAL_WINDOW_MS)
  })
})
