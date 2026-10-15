// e2e/global.setup.ts
//
// Runs once before the browser project: empties the e2e database, creates the
// owner account through the real setup page, answers the first-login retention
// prompt, and saves the signed-in cookies for every other test.
import { expect, test as setup } from "@playwright/test"
import { OWNER_STATE } from "../playwright.config"
import { resetDatabase } from "./db"
import { E2E_OWNER } from "./fixtures"

setup("fresh database and a signed-in owner", async ({ page }) => {
  await resetDatabase()

  // An instance with no account must send every visitor to setup, or a new
  // install is stuck at a login page with nothing to log in to.
  await page.goto("/")
  await expect(page).toHaveURL(/\/setup$/)
  await page.getByLabel("Username").fill(E2E_OWNER.username)
  await page.getByLabel("Master Password").fill(E2E_OWNER.password)
  await page.getByLabel("Confirm Password").fill(E2E_OWNER.password)
  await page.getByRole("button", { name: "Create Account" }).click()
  await page.waitForURL("/")

  // First login opens the retention prompt as a modal over the dashboard.
  // null means "keep snapshots forever"; answering here keeps it out of every test.
  const prompt = await page.request.post("/api/settings/retention-prompt", {
    data: { snapshotRetentionDays: null },
  })
  expect(prompt.ok()).toBe(true)

  // The first visit on a fresh profile also opens the What's New modal. Dismissing
  // it writes lastSeenVersion to localStorage, which the saved state carries.
  await page.getByRole("button", { name: "Neat" }).click()
  await expect(page.getByRole("button", { name: "Neat" })).toBeHidden()

  await page.context().storageState({ path: OWNER_STATE })
})
