// src/components/DownloadClients.test.tsx
//
// The Add Client form once sent no type at all, so every client it created was
// qBittorrent whatever the user meant. These tests read the POST it sends, the
// credential fields the card offers each type, the card's error line, and the
// section's docs link.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DOCS } from "@/lib/constants"

import { DownloadClients } from "./DownloadClients"

const fetchMock = vi.fn()

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body }
}

/** The body of the POST that creates the client. */
function createdClient(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => String(url) === "/api/clients" && init?.method === "POST"
  )
  expect(call, "the form sent no POST").toBeDefined()
  return JSON.parse(String(call?.[1]?.body))
}

/** What GET /api/clients answers. Every other GET, such as uptime, answers 404. */
let clients: Record<string, unknown>[] = []

beforeEach(() => {
  clients = []
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    if (init?.method === "POST") return jsonResponse({ id: 7 })
    if (String(url) === "/api/clients") return jsonResponse(clients)
    return { ok: false, status: 404, json: async () => ({}) }
  })
  vi.stubGlobal("fetch", fetchMock)
})

function renderClients() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DownloadClients />
    </QueryClientProvider>
  )
}

async function openAddForm(user: ReturnType<typeof userEvent.setup>) {
  renderClients()
  await user.click(await screen.findByRole("button", { name: "Add Download Client" }))
}

async function chooseType(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: "Client type" }))
  await user.click(screen.getByRole("option", { name: label }))
}

describe("Add Client form", () => {
  it("sends the Transmission type with Transmission's port when the port was untouched", async () => {
    const user = userEvent.setup()
    await openAddForm(user)

    await chooseType(user, "Transmission")
    await user.click(screen.getByRole("button", { name: "Create Client" }))

    expect(createdClient()).toMatchObject({ type: "transmission", port: 9091 })
  })

  it("keeps a port the user edited when the type changes", async () => {
    const user = userEvent.setup()
    await openAddForm(user)

    // Typed over a selection: NumberInput ignores the empty value a clear leaves.
    await user.tripleClick(screen.getByLabelText("Port"))
    await user.keyboard("8443")
    await chooseType(user, "Transmission")
    await user.click(screen.getByRole("button", { name: "Create Client" }))

    expect(createdClient()).toMatchObject({ type: "transmission", port: 8443 })
  })

  it("offers no API-key login for Transmission and drops one already chosen", async () => {
    const user = userEvent.setup()
    await openAddForm(user)

    await user.click(screen.getByRole("button", { name: "Authentication method" }))
    await user.click(screen.getByRole("option", { name: "API Key" }))
    await chooseType(user, "Transmission")

    expect(screen.queryByRole("button", { name: "Authentication method" })).toBeNull()
    expect(screen.queryByLabelText("API Key")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Create Client" }))
    const sent = createdClient()
    expect(sent).toMatchObject({ type: "transmission", authMethod: "password" })
    expect(sent).not.toHaveProperty("apiKey")
  })

  it("rTorrent is selectable and sends port 80 with password login", async () => {
    const user = userEvent.setup()
    await openAddForm(user)

    await user.click(screen.getByRole("button", { name: "Authentication method" }))
    await user.click(screen.getByRole("option", { name: "API Key" }))
    await chooseType(user, "rTorrent")

    expect(screen.queryByRole("button", { name: "Authentication method" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Create Client" }))
    expect(createdClient()).toMatchObject({ type: "rtorrent", port: 80, authMethod: "password" })
  })

  it("shows rTorrent's /RPC2 placeholder and credential hint", async () => {
    const user = userEvent.setup()
    await openAddForm(user)

    await chooseType(user, "rTorrent")

    expect(screen.getByPlaceholderText("/RPC2")).toBeTruthy()
    expect(screen.getByText(/rTorrent has no API-key login/)).toBeTruthy()
    expect(screen.queryByText(/rpc-authentication-required/)).toBeNull()
  })
})

describe("client card", () => {
  it("offers password fields to a Transmission client restored with an API-key method", async () => {
    // Restore inserts a backup's authMethod as it stands.
    clients = [
      {
        id: 3,
        name: "Seedbox",
        type: "transmission",
        authMethod: "apikey",
        hasCredentials: false,
        hasUrlPath: false,
        enabled: true,
        isDefault: true,
        host: "localhost",
        port: 9091,
        useSsl: false,
        pollIntervalSeconds: 300,
        crossSeedTags: [],
        lastError: null,
      },
    ]
    renderClients()

    expect(await screen.findByLabelText("Username")).toBeTruthy()
    expect(screen.queryByLabelText("API Key")).toBeNull()
  })

  // The heartbeat opens no outage for credentials it cannot read, so the card
  // shows the reason instead of a down clock that hides it.
  it("shows the stored-credentials error when no outage is open", async () => {
    const lastError =
      "Stored credentials or URL path can't be read. Enter them again in this client's settings"
    clients = [
      {
        id: 4,
        name: "Home qBT",
        type: "qbittorrent",
        authMethod: "password",
        hasCredentials: true,
        hasUrlPath: false,
        enabled: true,
        isDefault: true,
        host: "localhost",
        port: 8080,
        useSsl: false,
        pollIntervalSeconds: 300,
        crossSeedTags: [],
        lastError,
        errorSince: null,
      },
    ]
    renderClients()

    expect(await screen.findByText(lastError)).toBeTruthy()
    expect(screen.queryByText(/Down since/)).toBeNull()
  })

  it("says why a client is down beside how long it has been down", async () => {
    clients = [
      {
        id: 4,
        name: "Home qBT",
        type: "qbittorrent",
        authMethod: "password",
        hasCredentials: true,
        hasUrlPath: false,
        enabled: true,
        isDefault: true,
        host: "localhost",
        port: 8080,
        useSsl: false,
        pollIntervalSeconds: 300,
        crossSeedTags: [],
        lastError: "Connection refused",
        errorSince: new Date(Date.now() - 10 * 60_000).toISOString(),
      },
    ]
    renderClients()

    expect(await screen.findByText(/^Down since .+: Connection refused$/)).toBeTruthy()
  })
})

describe("section header", () => {
  it("titles the section and links the download clients docs", async () => {
    const user = userEvent.setup()
    renderClients()

    const section = await screen.findByRole("region", { name: "Download Clients" })
    await user.hover(
      within(section).getByRole("button", { name: "More info, opens documentation" })
    )

    expect(await screen.findByRole("link", { name: "Documentation →" })).toHaveAttribute(
      "href",
      DOCS.DOWNLOAD_CLIENTS.href
    )
  })
})
