// src/components/settings/__tests__/BackupsSection.test.tsx

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BackupsSection } from "@/components/settings/BackupsSection"
import { BACKUP_RESTORE_MAX_BYTES } from "@/lib/limits"

const INITIAL_CONFIG = {
  encryptBackups: false,
  hasBackupPassword: false,
  scheduleEnabled: false,
  scheduleFrequency: "daily",
  backupRetentionCount: 14,
  backupStoragePath: "/data/backups",
}
const CANARY = "CANARY-master-password"
const RESTORE_URL = "/api/settings/backup/restore"
const ALL_RECOVERABLE = {
  sameSalt: true,
  canPassThrough: true,
  credentialsTotal: 3,
  credentialsRecoverable: 3,
  credentialsAtRisk: 0,
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response("[]"))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A backup file that reports `size` bytes without holding them. */
function backupFile(size: number): File {
  const file = new File(["{}"], "backup.json", { type: "application/json" })
  Object.defineProperty(file, "size", { value: size })
  return file
}

/** Answers restore requests by hand, so a test can act while one is in flight. */
function holdRestoreRequests() {
  let respond: (res: Response) => void = () => {}
  fetchMock.mockImplementation((url: string) =>
    url === RESTORE_URL
      ? new Promise<Response>((resolve) => {
          respond = resolve
        })
      : Promise.resolve(new Response("[]"))
  )
  return (body: unknown, status = 200) => respond(new Response(JSON.stringify(body), { status }))
}

async function openRestoreForm(file: File) {
  const user = userEvent.setup()
  const { container } = render(<BackupsSection initialConfig={INITIAL_CONFIG} />)
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("no file input")
  await user.upload(input, file)
  return user
}

/** Types the master password, then moves on, which runs the backup check. */
async function enterPasswordAndPhrase(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "Confirm Restore" })
  await user.type(screen.getByLabelText("Master password"), CANARY)
  await user.type(screen.getByLabelText("Type RESTORE ALL DATA to confirm"), "RESTORE ALL DATA")
}

describe("BackupsSection restore", () => {
  it("refuses a backup over the size limit before reading it", async () => {
    const file = backupFile(BACKUP_RESTORE_MAX_BYTES + 1)
    const read = vi.spyOn(file, "text")
    await openRestoreForm(file)

    expect(
      (await screen.findAllByText("Backup file exceeds maximum size of 400 MB")).length
    ).toBeGreaterThan(0)
    expect(screen.queryByRole("heading", { name: "Confirm Restore" })).not.toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
  })

  it("opens the restore form for a backup at the size limit", async () => {
    await openRestoreForm(backupFile(BACKUP_RESTORE_MAX_BYTES))

    expect(await screen.findByRole("heading", { name: "Confirm Restore" })).toBeInTheDocument()
  })

  it("keeps Confirm Restore disabled while the backup check runs", async () => {
    const respond = holdRestoreRequests()
    const user = await openRestoreForm(backupFile(1024))
    await enterPasswordAndPhrase(user)

    const confirm = screen.getByRole("button", { name: "Confirm Restore" })
    expect(confirm).toBeDisabled()

    respond(ALL_RECOVERABLE)
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(
      screen.getByText("All 3 stored credentials in this backup can be restored.")
    ).toBeInTheDocument()
  })

  it("starts no second check while one is still uploading", async () => {
    holdRestoreRequests()
    const user = await openRestoreForm(backupFile(1024))
    await enterPasswordAndPhrase(user)

    await user.click(screen.getByLabelText("Master password"))
    await user.click(screen.getByLabelText("Type RESTORE ALL DATA to confirm"))

    expect(fetchMock.mock.calls.filter(([url]) => url === RESTORE_URL)).toHaveLength(1)
  })

  describe("after a check comes back", () => {
    const restoreCalls = () => fetchMock.mock.calls.filter(([url]) => url === RESTORE_URL)

    async function checkOnce(status = 200) {
      const respond = holdRestoreRequests()
      const user = await openRestoreForm(backupFile(1024))
      await enterPasswordAndPhrase(user)
      respond(status === 200 ? ALL_RECOVERABLE : { error: "busy" }, status)
      await waitFor(() =>
        expect(screen.queryByText("Checking this backup…")).not.toBeInTheDocument()
      )
      return user
    }

    async function leaveThePasswordField(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByLabelText("Master password"))
      await user.click(screen.getByLabelText("Type RESTORE ALL DATA to confirm"))
    }

    it("does not upload the file again when nothing changed", async () => {
      const user = await checkOnce()
      await leaveThePasswordField(user)

      expect(restoreCalls()).toHaveLength(1)
    })

    it("checks again when the last check failed", async () => {
      const user = await checkOnce(409)
      await leaveThePasswordField(user)

      expect(restoreCalls()).toHaveLength(2)
    })

    it("checks again once the password changes", async () => {
      const user = await checkOnce()
      await user.type(screen.getByLabelText("Master password"), "x")
      await user.click(screen.getByLabelText("Type RESTORE ALL DATA to confirm"))

      expect(restoreCalls()).toHaveLength(2)
    })
  })

  it("drops a check whose password changed while it ran", async () => {
    const respond = holdRestoreRequests()
    const user = await openRestoreForm(backupFile(1024))
    await enterPasswordAndPhrase(user)
    await user.type(screen.getByLabelText("Master password"), "x")

    respond(ALL_RECOVERABLE)
    await waitFor(() => expect(screen.queryByText("Checking this backup…")).not.toBeInTheDocument())
    expect(screen.queryByText(/stored credentials in this backup/)).not.toBeInTheDocument()
  })

  it("says nothing when the server is busy with another check", async () => {
    const respond = holdRestoreRequests()
    const user = await openRestoreForm(backupFile(1024))
    await enterPasswordAndPhrase(user)

    respond({ error: "A restore or backup check is already running." }, 409)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm Restore" })).toBeEnabled()
    )
    expect(screen.queryByText(/already running/)).not.toBeInTheDocument()
  })

  it("gives the backup check 30 seconds plus a second per MB", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    holdRestoreRequests()
    const user = await openRestoreForm(backupFile(242 * 1024 * 1024))
    await enterPasswordAndPhrase(user)

    expect(timeout).toHaveBeenCalledWith(272_000)
  })
})

describe("BackupsSection backup kind", () => {
  const ENVELOPE_REST = '"version":1,"createdAt":"x","encryptionSalt":"s","ciphertext":"c"}'

  async function openWith(content: string) {
    const file = new File([content], "backup.json", { type: "application/json" })
    const readWhole = vi.spyOn(file, "text")
    await openRestoreForm(file)
    await screen.findByRole("heading", { name: "Confirm Restore" })
    return readWhole
  }

  it.each([
    ["as exported", `{"format":"tracker-tracker-encrypted-backup",${ENVELOPE_REST}`],
    ["pretty-printed", `{\n  "format": "tracker-tracker-encrypted-backup",\n  ${ENVELOPE_REST}`],
  ])(
    "asks for the backup password of an encrypted backup %s without reading it whole",
    async (_, content) => {
      const readWhole = await openWith(content)

      expect(screen.getByLabelText("Backup password")).toBeInTheDocument()
      expect(readWhole).not.toHaveBeenCalled()
    }
  )

  it("asks for no backup password for a plain backup, without reading it whole", async () => {
    const readWhole = await openWith('{"manifest":{"version":1},"settings":{}}')

    expect(screen.queryByLabelText("Backup password")).not.toBeInTheDocument()
    expect(readWhole).not.toHaveBeenCalled()
  })

  it("reads a file that opens with neither key in full", async () => {
    const readWhole = await openWith(`{"version":1,"format":"tracker-tracker-encrypted-backup"}`)

    expect(screen.getByLabelText("Backup password")).toBeInTheDocument()
    expect(readWhole).toHaveBeenCalled()
  })
})
