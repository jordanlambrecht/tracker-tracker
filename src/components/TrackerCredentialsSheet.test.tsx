// src/components/TrackerCredentialsSheet.test.tsx
//
// The sheet's job is to let someone edit secrets they are never shown. Almost
// every test here is really the same assertion from a different angle: the
// plaintext must not appear until it is asked for, and asking for it must not be
// the price of using the feature.
//
// The three that would be silent regressions in production:
//   - copy must not reveal (a copy that leaks into the DOM still "works", so
//     nothing but a test catches it);
//   - saving must OMIT values the client never held (a save that sends
//     `value: ""` looks successful and destroys the vault);
//   - the clipboard fallback must speak up (this app is served over plain HTTP
//     on a LAN constantly, where navigator.clipboard simply does not exist).

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  TrackerCredentialsSheet,
  type TrackerCredentialsSheetProps,
} from "./TrackerCredentialsSheet"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

const PASSKEY = "super-secret-passkey-value"

/** What GET returns: the MASKED view. Note no `value` on the secret field. */
const VAULT_VIEW = {
  v: 1,
  sections: [
    {
      id: "irc",
      title: "IRC",
      fields: [
        { id: "irc_nick", label: "Nick", secret: false, value: "jordy" },
        { id: "passkey", label: "Passkey", secret: true, hasValue: true },
      ],
    },
  ],
}

const fetchMock = vi.fn()
let getResponse: { ok: boolean; status: number; body: unknown }
let putResponse: { ok: boolean; status: number; body: unknown }

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

function putCalls() {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
}

function revealCalls() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/reveal"))
}

/** The vault body of the last PUT, as the server would parse it. */
function lastPutVault() {
  const [, init] = putCalls()[putCalls().length - 1]
  return JSON.parse(String((init as RequestInit).body)).vault
}

function renderSheet(overrides: Partial<TrackerCredentialsSheetProps> = {}) {
  const props: TrackerCredentialsSheetProps = {
    open: true,
    trackerId: 42,
    trackerName: "Aither",
    // Deliberately NOT in the registry, so the defaults seed is the deterministic
    // universal fallback (a single `api_key`) rather than whatever platform list
    // the registry happens to carry today.
    trackerBaseUrl: "https://not-a-real-tracker.test",
    onClose: vi.fn(),
    ...overrides,
  }
  render(<TrackerCredentialsSheet {...props} />)
  return props
}

/** Wait for the sheet to finish loading before poking at it. */
async function ready() {
  return screen.findByRole("button", { name: "Add section" })
}

// ─── Clipboard stubbing ───────────────────────────────────────────────────────
//
// jsdom implements NEITHER navigator.clipboard nor document.execCommand, so both
// have to be installed by hand — which is convenient, because varying them is
// exactly how the fallback ladder gets tested.
//
// The trap: userEvent.setup() installs its OWN clipboard stub over the top of
// whatever is there. Anything defined in beforeEach is therefore silently
// replaced the moment a test calls it, and the assertion fails with the
// baffling "[AsyncFunction writeText] is not a spy". setupUser() below exists
// solely to re-install ours AFTER userEvent has had its turn.

let clipboardStub: { writeText: ReturnType<typeof vi.fn> } | undefined
let execCommandStub: ReturnType<typeof vi.fn>

function installClipboardStubs() {
  Object.defineProperty(navigator, "clipboard", {
    value: clipboardStub,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(document, "execCommand", {
    value: execCommandStub,
    configurable: true,
    writable: true,
  })
}

/** userEvent.setup(), with our clipboard stubs put back afterwards. */
function setupUser() {
  const user = userEvent.setup()
  installClipboardStubs()
  return user
}

beforeEach(() => {
  fetchMock.mockReset()
  getResponse = { ok: true, status: 200, body: { vault: VAULT_VIEW } }
  putResponse = { ok: true, status: 200, body: { success: true } }

  fetchMock.mockImplementation(async (url: unknown, init?: RequestInit) => {
    const target = String(url)
    if (target.includes("/reveal")) return jsonResponse({ value: PASSKEY })
    if (init?.method === "PUT") {
      return jsonResponse(putResponse.body, { ok: putResponse.ok, status: putResponse.status })
    }
    return jsonResponse(getResponse.body, { ok: getResponse.ok, status: getResponse.status })
  })
  vi.stubGlobal("fetch", fetchMock)

  // Both routes work by default, so the happy path is the default; the ladder
  // tests take them away one at a time.
  clipboardStub = { writeText: vi.fn().mockResolvedValue(undefined) }
  execCommandStub = vi.fn().mockReturnValue(true)
  installClipboardStubs()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Masking ──────────────────────────────────────────────────────────────────

describe("the sheet loads masked", () => {
  it("renders a stored secret masked, with no plaintext anywhere and no reveal call", async () => {
    renderSheet()
    await ready()

    const passkey = screen.getByLabelText("Passkey") as HTMLInputElement
    expect(passkey.type).toBe("password")
    expect(passkey.value).toBe("")
    // The value is not merely hidden by CSS — it was never sent.
    expect(document.body.textContent).not.toContain(PASSKEY)
    // Loading the sheet must not cost one reveal per secret; that is the entire
    // difference between reveal-on-demand and "fetch everything then hide it".
    expect(revealCalls()).toHaveLength(0)
  })

  it("shows a field the user marked public without any round trip", async () => {
    renderSheet()
    await ready()

    // secret: false means exactly this — an IRC nick is not a secret and does
    // not deserve a reveal round trip.
    expect((screen.getByLabelText("Nick") as HTMLInputElement).value).toBe("jordy")
    expect(revealCalls()).toHaveLength(0)
  })

  it("offers no Show toggle for a public field", async () => {
    renderSheet()
    await ready()

    expect(screen.queryByRole("button", { name: "Show Nick" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show Passkey" })).toBeInTheDocument()
  })
})

// ─── Reveal ───────────────────────────────────────────────────────────────────

describe("reveal fetches exactly one field", () => {
  it("requests only the clicked field, by id, over POST", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Show Passkey" }))

    await waitFor(() => expect(revealCalls()).toHaveLength(1))
    const [url, init] = revealCalls()[0]
    expect(String(url)).toContain("/api/trackers/42/credentials/reveal")
    expect((init as RequestInit).method).toBe("POST")
    // The id travels in the BODY, not the URL — URLs land in access logs and
    // browser history.
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ fieldId: "passkey" })
  })

  it("puts the revealed value on screen and flips the toggle's state", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Show Passkey" }))

    await waitFor(() =>
      expect((screen.getByLabelText("Passkey") as HTMLInputElement).value).toBe(PASSKEY)
    )
    // aria-pressed, so assistive tech can read the state rather than infer it
    // from the icon.
    expect(screen.getByRole("button", { name: "Hide Passkey" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("surfaces the rate limiter's own message instead of a generic failure", async () => {
    const user = setupUser()
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes("/reveal")) {
        return jsonResponse({ error: "Too many reveals. Wait a moment and try again." }, {
          ok: false,
          status: 429,
        })
      }
      return jsonResponse({ vault: VAULT_VIEW })
    })
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Show Passkey" }))

    // "Too many reveals" tells the user to wait; "something went wrong" tells
    // them to file a bug.
    expect(await screen.findByText(/Too many reveals/)).toBeInTheDocument()
  })
})

// ─── Copy ─────────────────────────────────────────────────────────────────────

describe("copy works WITHOUT revealing", () => {
  it("copies an unrevealed secret while leaving it masked", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))

    await waitFor(() => expect(clipboardStub?.writeText).toHaveBeenCalledWith(PASSKEY))
    // The whole point: the fetched value went to the clipboard and nowhere else.
    const passkey = screen.getByLabelText("Passkey") as HTMLInputElement
    expect(passkey.type).toBe("password")
    expect(passkey.value).toBe("")
    expect(document.body.textContent).not.toContain(PASSKEY)
    expect(screen.getByRole("button", { name: "Show Passkey" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("announces the copy to a screen reader", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))

    // A green tick is invisible to a screen reader; a polite live region is not.
    const status = await screen.findByTestId("credential-announcer")
    await waitFor(() => expect(status).toHaveTextContent("Passkey copied to clipboard"))
  })

  it("copying does not mark the form dirty", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))
    await waitFor(() => expect(clipboardStub?.writeText).toHaveBeenCalled())

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("showing a stored-but-EMPTY secret does not mark the form dirty", async () => {
    const user = setupUser()
    getResponse = {
      ok: true,
      status: 200,
      body: {
        vault: {
          v: 1,
          sections: [
            {
              id: "api",
              title: "API",
              // hasValue false: the field exists, nothing is in it.
              fields: [{ id: "api_key", label: "API key", secret: true, hasValue: false }],
            },
          ],
        },
      },
    }
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Show API key" }))

    // There is nothing to reveal, so no round trip — and flipping to shown must
    // not quietly convert "not held" into "held and empty", which is an edit.
    expect(revealCalls()).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled())
  })

  it("revealing and hiding again does not mark the form dirty", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Show Passkey" }))
    await screen.findByRole("button", { name: "Hide Passkey" })
    await user.click(screen.getByRole("button", { name: "Hide Passkey" }))

    // Looking at a secret is not an edit. If it were, every reveal would end in
    // a spurious "discard your changes?" prompt.
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled())
  })
})

// ─── The clipboard ladder ─────────────────────────────────────────────────────

describe("the clipboard fallback", () => {
  it("falls back to execCommand when navigator.clipboard is absent", async () => {
    // Exactly the shape of a plain-HTTP LAN deployment: the Clipboard API is not
    // merely permission-denied there, it is UNDEFINED.
    clipboardStub = undefined
    const user = setupUser()
    renderSheet()
    await ready()
    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))

    await waitFor(() => expect(execCommandStub).toHaveBeenCalledWith("copy"))
    const status = await screen.findByTestId("credential-announcer")
    await waitFor(() => expect(status).toHaveTextContent("Passkey copied to clipboard"))
  })

  it("falls back when the Clipboard API rejects rather than being absent", async () => {
    clipboardStub = { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) }
    const user = setupUser()
    renderSheet()
    await ready()
    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))

    // Safari treats a write after a network round trip as outside the user
    // gesture, which rejects — the ladder has to catch that, not just absence.
    await waitFor(() => expect(execCommandStub).toHaveBeenCalledWith("copy"))
  })

  it("SAYS SO when every route fails, instead of doing nothing", async () => {
    clipboardStub = undefined
    execCommandStub = vi.fn().mockReturnValue(false)
    const user = setupUser()
    renderSheet()
    await ready()
    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))

    // A silent no-op is worse than no button: the user pastes whatever was on
    // the clipboard before and believes it is their passkey.
    expect(await screen.findByText(/blocked the clipboard/)).toBeInTheDocument()
    const status = screen.getByTestId("credential-announcer")
    await waitFor(() => expect(status).toHaveTextContent(/Could not copy Passkey/))
  })

  it("offers to show the value manually once the clipboard has failed", async () => {
    clipboardStub = undefined
    execCommandStub = vi.fn().mockReturnValue(false)
    const user = setupUser()
    renderSheet()
    await ready()
    await user.click(screen.getByRole("button", { name: "Copy Passkey" }))

    // The escape hatch: if the machine cannot copy for them, at least let them
    // read it. Deliberately a second, explicit click — not automatic.
    await user.click(await screen.findByRole("button", { name: "Show it instead" }))
    await waitFor(() =>
      expect((screen.getByLabelText("Passkey") as HTMLInputElement).value).toBe(PASSKEY)
    )
  })
})

// ─── The opt-in gate ──────────────────────────────────────────────────────────

describe("the opt-in gate", () => {
  beforeEach(() => {
    getResponse = {
      ok: false,
      status: 403,
      body: { error: "disabled", credentialVaultDisabled: true },
    }
  })

  it("still opens, explains itself, and links straight at the Settings toggle", async () => {
    renderSheet()

    expect(await screen.findByText(/Credential storage is turned off/)).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Enable in Settings" })
    // The owner's requirement is verbatim "links DIRECTLY to that toggle". A bare
    // /settings link would satisfy the words and not the intent.
    expect(link).toHaveAttribute("href", "/settings#credential-vault-heading")
  })

  it("offers no editor at all while the feature is off", async () => {
    renderSheet()
    await screen.findByText(/Credential storage is turned off/)

    expect(screen.queryByRole("button", { name: "Add section" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
  })

  it("treats an ordinary 403 as an error, not as the gate", async () => {
    // The gate is identified by a FIELD. A 403 without it is a real failure and
    // must not be dressed up as a friendly opt-in prompt.
    getResponse = { ok: false, status: 403, body: { error: "Forbidden" } }
    renderSheet()

    expect(await screen.findByText("Forbidden")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Enable in Settings" })).not.toBeInTheDocument()
  })
})

// ─── Editing and saving ───────────────────────────────────────────────────────

describe("saving", () => {
  it("OMITS the value of a secret the user never held", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.clear(screen.getByLabelText("Section title"))
    await user.type(screen.getByLabelText("Section title"), "IRC stuff")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    const field = lastPutVault().sections[0].fields[1]
    // The single most destructive bug this feature could ship: a rename that
    // sends `value: ""` and wipes the passkey behind a successful save.
    expect(field).not.toHaveProperty("value")
    expect(field.id).toBe("passkey")
    // `secret` is always explicit, because the server takes it from the input
    // alone and an omitted flag would re-secret a field the user made public.
    expect(field.secret).toBe(true)
    expect(lastPutVault().sections[0].fields[0]).toMatchObject({
      id: "irc_nick",
      secret: false,
      value: "jordy",
    })
  })

  it("sends a value the user actually typed", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.type(screen.getByLabelText("Passkey"), "typed-replacement")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    expect(lastPutVault().sections[0].fields[1].value).toBe("typed-replacement")
  })

  it("treats emptying a MASKED box as 'no change', not as a clear", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    const passkey = screen.getByLabelText("Passkey")
    await user.type(passkey, "oops")
    await user.clear(passkey)

    // The user cannot see what they are deleting in a masked box, so a stray
    // keystroke must not be able to destroy a stored passkey. Clearing is an
    // explicit, separate button.
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled())
  })

  it("sends an explicit empty string when the user clicks Clear", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Clear stored value" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    // "" and omitted mean opposite things on the wire; this is the only way the
    // UI can express the destructive one.
    expect(lastPutVault().sections[0].fields[1].value).toBe("")
  })

  it("blocks the save on a validation error, without a round trip", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.clear(screen.getAllByLabelText("Field name")[1])
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(/needs a label/)).toBeInTheDocument()
    expect(putCalls()).toHaveLength(0)
  })

  it("shows the server's error when the save fails, and keeps the draft", async () => {
    const user = setupUser()
    putResponse = { ok: false, status: 500, body: { error: "Could not read the stored credentials" } }
    renderSheet()
    await ready()

    await user.type(screen.getByLabelText("Passkey"), "x")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(/Could not read the stored credentials/)).toBeInTheDocument()
    // The draft survives, so the user's typing is not thrown away by a failure
    // they had no part in.
    expect((screen.getByLabelText("Passkey") as HTMLInputElement).value).toBe("x")
  })
})

// ─── Structure editing ────────────────────────────────────────────────────────

describe("sections and fields", () => {
  it("adds, renames and deletes sections", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Add section" }))
    const titles = screen.getAllByLabelText("Section title") as HTMLInputElement[]
    expect(titles).toHaveLength(2)

    await user.clear(titles[1])
    await user.type(titles[1], "autodl")
    expect((screen.getAllByLabelText("Section title")[1] as HTMLInputElement).value).toBe("autodl")

    await user.click(screen.getByRole("button", { name: "Delete autodl" }))
    expect(screen.getAllByLabelText("Section title")).toHaveLength(1)
  })

  it("reorders sections, and disables the moves that would fall off the ends", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Add section" }))
    // ARRAY ORDER IS DISPLAY ORDER — there is no sortOrder to get out of sync.
    expect(screen.getByRole("button", { name: "Move IRC up" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Move IRC down" }))
    const titles = screen.getAllByLabelText("Section title") as HTMLInputElement[]
    expect(titles.map((t) => t.value)).toEqual(["New section", "IRC"])
  })

  it("adds a field and gives it an id derived from its label on save", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Add field" }))
    const names = screen.getAllByLabelText("Field name") as HTMLInputElement[]
    await user.clear(names[names.length - 1])
    await user.type(names[names.length - 1], "Announce URL")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(putCalls()).toHaveLength(1))
    const added = lastPutVault().sections[0].fields[2]
    // Derived late, from what the user actually typed — so it lands as
    // `announce_url` rather than as `new_field`.
    expect(added.id).toBe("announce_url")
    expect(added.value).toBe("")
  })

  it("removes a field", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Remove Passkey" }))
    expect(screen.queryByLabelText("Passkey")).not.toBeInTheDocument()
  })
})

// ─── Seeding a new vault ──────────────────────────────────────────────────────

describe("a tracker with no vault yet", () => {
  beforeEach(() => {
    getResponse = { ok: true, status: 200, body: { vault: null } }
  })

  it("seeds from the registry defaults", async () => {
    renderSheet()
    await ready()

    // The universal fallback for an unrecognised tracker.
    expect(screen.getByLabelText("API key")).toBeInTheDocument()
    expect((screen.getAllByLabelText("Section title")[0] as HTMLInputElement).value).toBe(
      "Credentials"
    )
  })

  it("does not count the seed as an unsaved change", async () => {
    renderSheet()
    await ready()

    // Opening and closing a sheet the user has not touched must not prompt them
    // to discard "changes" the app invented.
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByText("No changes")).toBeInTheDocument()
  })
})

// ─── Unsaved changes on close ─────────────────────────────────────────────────

describe("closing with unsaved changes", () => {
  it("intercepts the close and asks, rather than dropping the edits", async () => {
    const user = setupUser()
    const props = renderSheet()
    await ready()

    await user.type(screen.getByLabelText("Passkey"), "half-typed")
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(await screen.findByText(/unsaved credential changes/)).toBeInTheDocument()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it("closes on confirm", async () => {
    const user = setupUser()
    const props = renderSheet()
    await ready()

    await user.type(screen.getByLabelText("Passkey"), "half-typed")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(await screen.findByRole("button", { name: "Discard and close" }))

    expect(props.onClose).toHaveBeenCalled()
  })

  it("dismisses the prompt after 'Save and keep editing' succeeds", async () => {
    const user = setupUser()
    const props = renderSheet()
    await ready()

    await user.type(screen.getByLabelText("Passkey"), "half-typed")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(await screen.findByRole("button", { name: "Save and keep editing" }))

    // The draft is clean now, so leaving the prompt up would be asking the user
    // to discard changes that have just been persisted.
    await waitFor(() =>
      expect(screen.queryByText(/unsaved credential changes/)).not.toBeInTheDocument()
    )
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it("does not yank focus out of an input when a save reloads the sheet", async () => {
    const user = setupUser()
    renderSheet()
    await ready()

    const passkey = screen.getByLabelText("Passkey")
    await user.type(passkey, "typed")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(putCalls()).toHaveLength(1))

    // Saving re-runs the load, cycling status ready → loading → ready. Without a
    // once-per-open latch on the open-focus effect, that would move focus onto
    // the sheet container after every single save.
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled())
    expect(document.activeElement).not.toBe(
      screen.getByRole("dialog").querySelector("[tabindex='-1']")
    )
  })

  it("closes immediately when nothing has changed", async () => {
    const user = setupUser()
    const props = renderSheet()
    await ready()

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(props.onClose).toHaveBeenCalled()
    expect(screen.queryByText(/unsaved credential changes/)).not.toBeInTheDocument()
  })

  it("routes Escape through the same interception as the Close button", async () => {
    const user = setupUser()
    const props = renderSheet()
    await ready()

    await user.type(screen.getByLabelText("Passkey"), "half-typed")
    await user.keyboard("{Escape}")

    // Backdrop, X and Escape all funnel through Sheet's single onClose, so one
    // interception point has to cover all three.
    expect(await screen.findByText(/unsaved credential changes/)).toBeInTheDocument()
    expect(props.onClose).not.toHaveBeenCalled()
  })
})

// ─── Accessibility ────────────────────────────────────────────────────────────

describe("accessibility", () => {
  it("gives every icon-only control an accessible name that names its field", async () => {
    renderSheet()
    await ready()

    // Without the field name in there, a screen reader user hears "Copy" five
    // times and cannot tell which button is which.
    for (const name of ["Copy Passkey", "Show Passkey", "Remove Passkey", "Copy Nick"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
  })

  it("labels each value input with its field name", async () => {
    renderSheet()
    await ready()

    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByLabelText("Passkey")).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Nick")).toBeInTheDocument()
  })

  it("moves focus into the sheet when it opens", async () => {
    renderSheet()
    await ready()

    // Otherwise Tab and Escape start from the top of the document, outside the
    // dialog the user just opened.
    const dialog = screen.getByRole("dialog")
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
  })
})
