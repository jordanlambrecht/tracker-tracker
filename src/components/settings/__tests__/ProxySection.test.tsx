// src/components/settings/__tests__/ProxySection.test.tsx
//
// The proxy's fields and its Save button live under the toggle. Turning the
// toggle off must still leave a way to save that, or a saved proxy stays on.

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ProxySection, type ProxySectionProps } from "@/components/settings/ProxySection"

const fetchMock = vi.fn()

function savedProxy(overrides: Partial<ProxySectionProps["initialProxy"]> = {}) {
  return {
    enabled: true,
    type: "socks5",
    host: "proxy.example.test",
    port: 1080,
    username: "",
    hasPassword: false,
    ...overrides,
  }
}

function patchBodies(): Record<string, unknown>[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => url === "/api/settings" && init?.method === "PATCH")
    .map(([, init]) => JSON.parse(String(init.body)))
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"))
    return new Response(JSON.stringify({ ...body, hasProxyPassword: false }))
  })
  vi.stubGlobal("fetch", fetchMock)
})

describe("ProxySection", () => {
  it.each([
    ["with its host", savedProxy()],
    ["with no host stored", savedProxy({ host: "" })],
  ])("saves turning a saved proxy off, %s", async (_case, initialProxy) => {
    const user = userEvent.setup()
    render(<ProxySection initialProxy={initialProxy} trackers={[]} />)

    await user.click(screen.getByRole("switch"))
    await user.click(screen.getByRole("button", { name: "Save Proxy" }))

    expect(patchBodies()).toEqual([expect.objectContaining({ proxyEnabled: false })])
    expect(await screen.findByText("Proxy settings saved.")).toBeInTheDocument()
  })

  it("keeps Save off while the proxy is on with no host", async () => {
    const user = userEvent.setup()
    render(<ProxySection initialProxy={savedProxy({ enabled: false, host: "" })} trackers={[]} />)

    await user.click(screen.getByRole("switch"))

    expect(screen.getByRole("button", { name: "Save Proxy" })).toBeDisabled()
  })
})
