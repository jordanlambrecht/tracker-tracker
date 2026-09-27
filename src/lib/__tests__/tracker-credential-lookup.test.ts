// src/lib/__tests__/tracker-credential-lookup.test.ts

import { describe, expect, it } from "vitest"
import { findCredentialValue } from "@/lib/tracker-credentials/lookup"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"

const vault: TrackerCredentialVault = {
  v: 1,
  sections: [
    { id: "api", title: "API", fields: [{ id: "api_key", label: "API key", value: "k" }] },
    {
      id: "account",
      title: "Account",
      fields: [
        { id: "blank", label: "Blank", value: "  " },
        { id: "username", label: "Username", value: " someone ", secret: false },
      ],
    },
  ],
}

describe("findCredentialValue", () => {
  it("finds a field in any section and trims it", () => {
    expect(findCredentialValue(vault, "username")).toBe("someone")
  })

  it("returns null for a missing or blank field", () => {
    expect(findCredentialValue(vault, "passkey")).toBeNull()
    expect(findCredentialValue(vault, "blank")).toBeNull()
  })
})
