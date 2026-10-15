// src/lib/__tests__/tracker-credential-gate.test.ts
//
// The opt-in gate's own logic, isolated from the routes that call it.
//
// The case worth writing a file for is the ABSENT settings row. A fresh install
// has no row at all, and "no row" must read as DISABLED, if it read as enabled,
// the feature's default would depend on whether the settings row happened to
// have been created yet, which is not a property anyone can reason about.

import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/lib/db"
import { requireCredentialVaultEnabled } from "@/lib/tracker-credentials/gate"

vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { credentialVaultEnabled: "app_settings.credential_vault_enabled" },
}))

let settingsRows: Record<string, unknown>[]

beforeEach(() => {
  vi.clearAllMocks()
  settingsRows = [{ credentialVaultEnabled: true }]
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({ limit: () => Promise.resolve(settingsRows) }),
  })
})

describe("requireCredentialVaultEnabled", () => {
  it("returns null — meaning proceed — when the feature is on", async () => {
    await expect(requireCredentialVaultEnabled()).resolves.toBeNull()
  })

  it("returns a 403 when the feature is off", async () => {
    settingsRows = [{ credentialVaultEnabled: false }]
    const response = await requireCredentialVaultEnabled()
    expect(response?.status).toBe(403)
  })

  it("FAILS CLOSED when there is no settings row at all", async () => {
    // A fresh or half-configured install. Defaulting this to "enabled" would
    // hand out a live reveal endpoint on a box that has never been configured.
    settingsRows = []
    const response = await requireCredentialVaultEnabled()
    expect(response?.status).toBe(403)
  })

  it("flags the refusal with a field so callers need not match on the message", async () => {
    settingsRows = [{ credentialVaultEnabled: false }]
    const response = await requireCredentialVaultEnabled()
    const body = (await response?.json()) as Record<string, unknown>
    // The sheet branches on this to decide whether to render the opt-in
    // explanation. Branching on the error TEXT would break the moment anyone
    // rewords it.
    expect(body.credentialVaultDisabled).toBe(true)
    expect(typeof body.error).toBe("string")
  })
})
