// src/components/settings/__tests__/CredentialVaultSection.test.tsx
//
// The load-bearing test here is the ANCHOR one.
//
// The owner's requirement was verbatim: the sheet needs "an opt in button that
// links to the button on the settings page". That link is a hash into this
// section — and a hash pointing at an id that does not exist fails SILENTLY. The
// browser just does not scroll, the user lands at the top of Settings, and
// nothing anywhere reports a problem. Nothing but a test that renders the
// section and looks for the exact element the href names can catch that.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  CREDENTIAL_VAULT_SETTINGS_HREF,
  CredentialVaultSection,
} from "@/components/settings/CredentialVaultSection"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ credentialVaultEnabled: true }),
  })
  vi.stubGlobal("fetch", fetchMock)
})

describe("CredentialVaultSection", () => {
  it("renders the exact element the sheet's deep link points at", () => {
    render(<CredentialVaultSection initialEnabled={false} />)

    const fragment = CREDENTIAL_VAULT_SETTINGS_HREF.split("#")[1]
    expect(fragment).toBeTruthy()
    // If the section id is ever renamed without updating the href (or vice
    // versa), this is the only thing that will notice.
    expect(document.getElementById(fragment)).not.toBeNull()
  })

  it("points that link at the Settings page itself", () => {
    expect(CREDENTIAL_VAULT_SETTINGS_HREF.startsWith("/settings#")).toBe(true)
  })

  it("renders the toggle as a switch reporting its state", () => {
    render(<CredentialVaultSection initialEnabled={false} />)

    const toggle = screen.getByRole("switch", { name: /Store tracker credentials/ })
    expect(toggle).toHaveAttribute("aria-checked", "false")
  })

  it("PATCHes the flag and adopts the server's answer, not the optimistic one", async () => {
    const user = userEvent.setup()
    render(<CredentialVaultSection initialEnabled={false} />)

    await user.click(screen.getByRole("switch", { name: /Store tracker credentials/ }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ method: "PATCH" })
    )
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body).toEqual({ credentialVaultEnabled: true })
    expect(await screen.findByRole("switch", { name: /Store tracker credentials/ })).toHaveAttribute(
      "aria-checked",
      "true"
    )
  })

  it("says out loud that turning it off does not delete anything", () => {
    render(<CredentialVaultSection initialEnabled={false} />)

    // Otherwise the only way to learn whether disabling is destructive is to try
    // it on your own passkeys.
    expect(screen.getByText(/Anything you have already stored is kept/)).toBeInTheDocument()
  })

  it("surfaces a failed PATCH instead of silently reverting", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to save settings" }),
    })
    render(<CredentialVaultSection initialEnabled={false} />)

    await user.click(screen.getByRole("switch", { name: /Store tracker credentials/ }))

    expect(await screen.findByText("Failed to save settings")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /Store tracker credentials/ })).toHaveAttribute(
      "aria-checked",
      "false"
    )
  })
})
