// e2e/smoke.spec.ts
//
// The browser paths a release must not break: signing in, and the tracker flows
// that unit tests can only pin at the component level. Each test names the
// decision it protects; a test with no failure worth catching does not belong.
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "@playwright/test"
import { getTrackerBySlug } from "../src/data/tracker-registry"
import { storedApiToken } from "./db"
import { E2E_OWNER, E2E_TRACKER } from "./fixtures"

// The registry is the source of the URL the row must end up with. Copying the
// address into the test would make a registry edit fail the suite for no bug.
const entry = getTrackerBySlug(E2E_TRACKER.slug)
if (!entry) throw new Error(`registry has no entry for ${E2E_TRACKER.slug}`)

test.describe("signing in", () => {
  // No saved cookies: this test is the login form itself.
  test.use({ storageState: { cookies: [], origins: [] } })

  test("the login form unlocks the dashboard", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel("Username").fill(E2E_OWNER.username)
    await page.getByLabel("Password", { exact: true }).fill(E2E_OWNER.password)
    await page.getByRole("button", { name: "Unlock" }).click()

    await page.waitForURL("/")
    await expect(page.getByRole("navigation", { name: "Trackers" })).toBeVisible()
  })
})

test.describe.serial("a tracker added from the registry", () => {
  let trackerId = 0

  test.afterAll(async ({ request }) => {
    if (trackerId) await request.delete(`/api/trackers/${trackerId}`)
  })

  test("Add Tracker sends the registry slug and the row takes the registry URL", async ({
    page,
  }) => {
    // Answered in the browser so the server never contacts the real site: the
    // connection test would fail on a fake token, and the first poll is
    // fire-and-forget. The create itself makes no outbound request.
    await page.route("**/api/trackers/test-connection", (route) =>
      route.fulfill({ json: { username: E2E_OWNER.username, group: "Member" } })
    )
    await page.route("**/api/trackers/*/poll", (route) => route.fulfill({ json: { ok: true } }))

    await page.goto("/")
    await page.getByRole("button", { name: "+ Add Tracker" }).click()

    // The dialog's content is in the DOM while closed; scope to the open one.
    const dialog = page.locator("dialog[open]")
    await dialog.getByRole("combobox").click()
    await dialog.getByPlaceholder("Search trackers...").fill(entry.name)
    await dialog.getByRole("option", { name: entry.name }).click()
    await dialog.getByLabel("API Token").fill(E2E_TRACKER.token)

    const [testRequest, createRequest] = await Promise.all([
      page.waitForRequest(
        (r) => r.method() === "POST" && r.url().endsWith("/api/trackers/test-connection")
      ),
      page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/trackers")),
      dialog.getByRole("button", { name: "Add Tracker" }).click(),
    ])

    expect(testRequest.postDataJSON()).toMatchObject({ slug: E2E_TRACKER.slug })
    expect(testRequest.postDataJSON()).not.toHaveProperty("baseUrl")
    expect(createRequest.postDataJSON()).toMatchObject({ slug: E2E_TRACKER.slug })
    expect(createRequest.postDataJSON()).not.toHaveProperty("baseUrl")

    const created = await createRequest.response()
    if (!created) throw new Error("POST /api/trackers produced no response")
    expect(created.status()).toBe(201)
    trackerId = ((await created.json()) as { id: number }).id

    const row = await (await page.request.get(`/api/trackers/${trackerId}`)).json()
    expect(row).toMatchObject({ registrySlug: E2E_TRACKER.slug, baseUrl: entry.url })

    // Park it: the e2e server's scheduler would otherwise poll the real site
    // with the fake token every five minutes for as long as the server lives.
    const paused = await page.request.patch(`/api/trackers/${trackerId}`, {
      data: { pollingPaused: true },
    })
    expect(paused.ok()).toBe(true)

    await expect(page.getByRole("navigation", { name: "Trackers" })).toContainText(entry.name)
  })

  test("the settings sheet offers no URL field", async ({ page }) => {
    await page.goto(`/trackers/${trackerId}`)
    await page.getByRole("button", { name: "Tracker settings" }).click()

    const sheet = page.getByRole("dialog", { name: "Tracker Settings" })
    await expect(sheet.getByLabel("Nickname")).toBeVisible()
    await expect(sheet.getByLabel(/url/i)).toHaveCount(0)

    const values = await sheet
      .locator("input")
      .evaluateAll((inputs) => inputs.map((el) => (el as HTMLInputElement).value))
    expect(values.some((v) => v.includes("aither.cc"))).toBe(false)
  })

  test("PATCH applies the name and ignores a URL in the body", async ({ request }) => {
    const res = await request.patch(`/api/trackers/${trackerId}`, {
      data: { name: "Aither renamed", baseUrl: "https://google.com" },
    })
    expect(res.status()).toBe(200)

    const after = await (await request.get(`/api/trackers/${trackerId}`)).json()
    expect(after).toMatchObject({ name: "Aither renamed", baseUrl: entry.url })
  })

  // A backup that does not restore is the most damaging rare failure the app has.
  // The unit guard proves the restore writes every column; this proves the whole
  // path with real encryption: export to disk, read the stored file back, wipe,
  // restore, and the row comes back with a token the server could re-encrypt.
  test("a backup exported to disk restores the tracker and its credential", async ({ request }) => {
    const storageDir = await mkdtemp(join(tmpdir(), "tt-e2e-backups-"))
    let backupId = 0
    try {
      const pathSet = await request.patch("/api/settings", {
        data: { backupStoragePath: storageDir },
      })
      expect(pathSet.ok()).toBe(true)

      const exported = await request.post("/api/settings/backup/export", { multipart: {} })
      expect(exported.ok()).toBe(true)
      const { filename } = (await exported.json()) as { success: boolean; filename: string }

      const history = (await (await request.get("/api/settings/backup/history")).json()) as {
        id: number
        hasStoredFile: boolean
      }[]
      expect(history[0]).toMatchObject({ hasStoredFile: true })
      backupId = history[0].id
      const stored = await request.get(`/api/settings/backup/${backupId}`)
      expect(stored.ok()).toBe(true)
      const file = await stored.body()

      const removed = await request.delete(`/api/trackers/${trackerId}`)
      expect(removed.ok()).toBe(true)
      expect(await (await request.get("/api/trackers")).json()).toEqual([])

      const restored = await request.post("/api/settings/backup/restore", {
        multipart: {
          file: { name: filename, mimeType: "application/json", buffer: file },
          masterPassword: E2E_OWNER.password,
        },
      })
      expect(restored.status()).toBe(200)
      expect(await restored.json()).toMatchObject({
        success: true,
        restored: { trackers: 1 },
        tokensPreserved: 1,
      })

      const rows = (await (await request.get("/api/trackers")).json()) as {
        id: number
        name: string
        registrySlug: string | null
        baseUrl: string
      }[]
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        name: "Aither renamed",
        registrySlug: E2E_TRACKER.slug,
        baseUrl: entry.url,
      })
      trackerId = rows[0].id
      expect(await storedApiToken(trackerId)).not.toBe("")

      // Restored rows poll again unless parked; keep the e2e server off the network.
      const paused = await request.patch(`/api/trackers/${trackerId}`, {
        data: { pollingPaused: true },
      })
      expect(paused.ok()).toBe(true)
    } finally {
      if (backupId) await request.delete(`/api/settings/backup/${backupId}`)
      await request.patch("/api/settings", { data: { backupStoragePath: null } })
      await rm(storageDir, { recursive: true, force: true })
    }
  })
})
