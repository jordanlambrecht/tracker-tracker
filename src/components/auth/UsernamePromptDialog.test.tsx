// src/components/auth/UsernamePromptDialog.test.tsx
//
// The prompt's trigger is `app_settings.username IS NULL`, read server-side by
// the (auth) layout and handed down as `needed`. That indirection is the point:
// the flag is computed after the layout's session redirect, so a login still
// waiting on its TOTP code never renders this component at all.
//
// The other load-bearing behaviour is what "Skip for now" means. It is scoped to
// the browser session, because a bare NULL check would re-ask on every
// navigation (the layout is force-dynamic), not once per login.

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { USERNAME_PROMPT_SKIP_KEY, UsernamePrompt } from "@/components/auth/UsernamePromptDialog"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))

const TITLE = /Set a login username/i

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body } as Response
}

/** Bodies of POSTs made so far, parsed. */
function postBodies(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls
    .map((c) => c[1] as RequestInit | undefined)
    .filter((init): init is RequestInit => init?.method === "POST")
    .map((init) => JSON.parse(init.body as string) as Record<string, unknown>)
}

afterEach(() => {
  vi.restoreAllMocks()
  refresh.mockClear()
  sessionStorage.clear()
})

describe("UsernamePrompt", () => {
  it("asks when no username is stored", async () => {
    render(<UsernamePrompt needed />)

    expect(await screen.findByText(TITLE)).toBeInTheDocument()
  })

  it("stays out of the way when a username is already stored", async () => {
    render(<UsernamePrompt needed={false} />)

    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument())
  })

  it("does not re-ask on a later page load in the same session after Skip for now", async () => {
    render(<UsernamePrompt needed />)
    const skip = await screen.findByRole("button", { name: /Skip for now/i })
    skip.click()

    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument())
    expect(sessionStorage.getItem(USERNAME_PROMPT_SKIP_KEY)).toBe("1")

    // A fresh mount stands in for the next navigation: the server still says the
    // username is NULL, but the suppressor is still set.
    const second = render(<UsernamePrompt needed />)
    await waitFor(() => expect(second.queryByText(TITLE)).not.toBeInTheDocument())
  })

  it("asks again once the suppressor is cleared, the way a new sign-in clears it", async () => {
    sessionStorage.setItem(USERNAME_PROMPT_SKIP_KEY, "1")
    const first = render(<UsernamePrompt needed />)
    await waitFor(() => expect(first.queryByText(TITLE)).not.toBeInTheDocument())
    first.unmount()

    // LoginForm removes this key on every sign-in attempt.
    sessionStorage.removeItem(USERNAME_PROMPT_SKIP_KEY)

    render(<UsernamePrompt needed />)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()
  })

  it("posts the trimmed username to the authenticated endpoint and stops asking", async () => {
    const user = userEvent.setup()
    const spy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(jsonResponse({ success: true, username: "jordy" }))

    render(<UsernamePrompt needed />)
    // Typed with the stray spaces the trim exists for.
    await user.type(await screen.findByRole("textbox"), "  jordy  ")
    await user.click(screen.getByRole("button", { name: /Save username/i }))

    await waitFor(() => expect(postBodies(spy)).toHaveLength(1))
    expect(spy.mock.calls[0][0]).toBe("/api/auth/username")
    expect(postBodies(spy)[0]).toEqual({ username: "jordy" })

    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument())
    // Server-rendered surfaces still hold the old NULL until this fires.
    expect(refresh).toHaveBeenCalled()
  })

  it("blocks an invalid username client-side without calling the server", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ success: true }))

    render(<UsernamePrompt needed />)
    await user.type(await screen.findByRole("textbox"), "ab")
    await user.click(screen.getByRole("button", { name: /Save username/i }))

    expect(
      await screen.findByText(/Username must be between 3 and 100 characters/i)
    ).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
    // Still asking, a rejected value is not an answer.
    expect(screen.getByText(TITLE)).toBeInTheDocument()
  })

  it("surfaces the server's own rejection and keeps asking", async () => {
    const user = userEvent.setup()
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ error: "A username is already set. Change it in Settings › Account." }, false)
    )

    render(<UsernamePrompt needed />)
    await user.type(await screen.findByRole("textbox"), "jordy")
    await user.click(screen.getByRole("button", { name: /Save username/i }))

    expect(await screen.findByText(/A username is already set/i)).toBeInTheDocument()
    expect(screen.getByText(TITLE)).toBeInTheDocument()
  })

  it("tells the user the username becomes required at the next sign-in", async () => {
    render(<UsernamePrompt needed />)

    expect(await screen.findByText(/required at your next sign-in/i)).toBeInTheDocument()
  })
})
