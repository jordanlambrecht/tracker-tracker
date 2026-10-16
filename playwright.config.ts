// playwright.config.ts
//
// Browser smoke tests against a real server and the throwaway
// `tracker_tracker_e2e` database, which every run wipes. e2e/db.ts refuses any
// database name that does not end in `_e2e`, so the real one is never touched.
//
//   pnpm test:e2e              production build (`pnpm build` first), port 3020
//   E2E_DEV=1 pnpm test:e2e    dev server instead, no build needed
import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

// The Playwright process does not load .env on its own; the server child
// inherits these, and global.setup.ts needs them to reach the database. Quiet,
// because knip loads this file and dotenv's tip line would corrupt its JSON output.
dotenv.config({ quiet: true })

export const E2E_DATABASE = "tracker_tracker_e2e"
export const OWNER_STATE = "e2e/.auth/owner.json"

const PORT = process.env.E2E_PORT ?? "3020"
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: "e2e",
  // One database, one worker: the serial tracker flow shares a row.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: OWNER_STATE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: process.env.E2E_DEV ? "pnpm dev" : "pnpm start",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT, POSTGRES_DB: E2E_DATABASE },
  },
})
