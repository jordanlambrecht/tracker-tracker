// src/components/dashboard/RetentionPromptDialog.test.tsx
//
// The retention question moved off the account-creation form to a first-login
// dialog, because asking how long to keep snapshots before a single snapshot
// exists gives the user nothing to reason about.
//
// The load-bearing behaviour is the pairing: "keep forever" must be sent as an
// explicit answer (null) AND recorded as answered. If it were inferred from
// `snapshotRetentionDays === null` the prompt could never tell "chose forever"
// from "never asked", and would either re-ask every load or never fire.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RetentionPrompt } from "@/components/dashboard/RetentionPromptDialog"
import { RETENTION_PROMPT_KEY } from "@/hooks/useRetentionPrompt"

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return { queryClient, ...view }
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response
}

/** Bodies of POSTs made so far, parsed. GETs ignored. */
function postBodies(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls
    .map((c) => c[1] as RequestInit | undefined)
    .filter((init): init is RequestInit => init?.method === "POST")
    .map((init) => JSON.parse(init.body as string) as Record<string, unknown>)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("RetentionPrompt", () => {
  it("asks when the question has never been answered", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ prompted: false }))

    renderWithClient(<RetentionPrompt />)

    expect(await screen.findByText(/How long should snapshot history be kept/i)).toBeInTheDocument()
  })

  it("stays out of the way once answered", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ prompted: true }))

    renderWithClient(<RetentionPrompt />)

    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(screen.queryByText(/How long should snapshot history be kept/i)).not.toBeInTheDocument()
  })

  it("fails closed — a broken check shows no undismissable modal", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("offline"))

    renderWithClient(<RetentionPrompt />)

    await waitFor(() =>
      expect(screen.queryByText(/How long should snapshot history be kept/i)).not.toBeInTheDocument()
    )
  })

  it("publishes the answer to the shared query so other surfaces react without a reload", async () => {
    // The dashboard banner reads the same query. Save must update it in place,
    // or the banner appears the moment the prompt closes and stays to reload.
    vi.spyOn(global, "fetch").mockImplementation((_url, init) =>
      Promise.resolve(jsonResponse(init?.method === "POST" ? { ok: true } : { prompted: false }))
    )
    const user = userEvent.setup()
    const { queryClient } = renderWithClient(<RetentionPrompt />)

    await screen.findByText(/How long should snapshot history be kept/i)
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(queryClient.getQueryData(RETENTION_PROMPT_KEY)).toEqual({ prompted: true })
    )
  })

  it("sends null for 'keep forever' — an explicit answer, not an absent one", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation((_url, init) => {
      if ((init as RequestInit | undefined)?.method === "POST") {
        return Promise.resolve(jsonResponse({ prompted: true, snapshotRetentionDays: null }))
      }
      return Promise.resolve(jsonResponse({ prompted: false }))
    })

    renderWithClient(<RetentionPrompt />)
    const save = await screen.findByRole("button", { name: /^Save$/i })
    save.click()

    await waitFor(() => expect(postBodies(spy)).toHaveLength(1))
    expect(postBodies(spy)[0]).toEqual({ snapshotRetentionDays: null })

    // ...and it stops asking.
    await waitFor(() =>
      expect(
        screen.queryByText(/How long should snapshot history be kept/i)
      ).not.toBeInTheDocument()
    )
  })
})
