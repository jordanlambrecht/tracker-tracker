// src/app/api/settings/dashboard/route.test.ts
//
// The PUT handler used to allowlist settings key by key, which silently dropped any field
// added to DashboardSettings afterwards. The client updates optimistically, so a dropped key
// looks saved until the page reloads. These tests pin the round-trip for every key.

import type { NextResponse } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { DASHBOARD_SETTINGS_DEFAULTS, type DashboardSettings } from "@/types/api"
import { PUT } from "./route"

vi.mock("@/lib/api-helpers", () => ({
  authenticate: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { select: vi.fn(), update: vi.fn() },
}))

vi.mock("@/lib/db/schema", () => ({
  appSettings: { id: "id", dashboardSettings: "dashboardSettings" },
}))

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

/** Captures whatever the handler writes back to app_settings.dashboard_settings. */
let written: string | null = null

function mockStoredRow(stored: string | null) {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ limit: () => Promise.resolve([{ id: 1, dashboardSettings: stored }]) }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  written = null
  vi.mocked(authenticate).mockResolvedValue({} as never)
  vi.mocked(db.update).mockReturnValue({
    set: (values: { dashboardSettings: string }) => {
      written = values.dashboardSettings
      return { where: () => Promise.resolve() }
    },
  } as never)
  mockStoredRow(null)
})

async function put(body: Record<string, unknown>): Promise<DashboardSettings> {
  vi.mocked(parseJsonBody).mockResolvedValue(body as never)
  const res = await PUT(new Request("http://localhost/api/settings/dashboard", { method: "PUT" }))
  return (await (res as NextResponse).json()) as DashboardSettings
}

describe("PUT /api/settings/dashboard", () => {
  const KEYS = Object.keys(DASHBOARD_SETTINGS_DEFAULTS) as (keyof DashboardSettings)[]

  // The regression guard. A key-by-key allowlist passes for the keys someone remembered and
  // fails here for the one they forgot, which is the whole failure mode.
  it.each(KEYS)("persists %s instead of silently dropping it", async (key) => {
    const flipped = !DASHBOARD_SETTINGS_DEFAULTS[key]

    const body = await put({ [key]: flipped })

    expect(body[key], `${key} missing from the PUT response`).toBe(flipped)
    expect(written, "handler wrote nothing to the database").not.toBeNull()
    expect(
      (JSON.parse(written as string) as DashboardSettings)[key],
      `${key} was not written to the database`
    ).toBe(flipped)
  })

  it("leaves keys the caller did not send untouched", async () => {
    mockStoredRow(JSON.stringify({ ...DASHBOARD_SETTINGS_DEFAULTS, showLoginTimers: false }))

    const body = await put({ showTodayAtAGlance: false })

    expect(body.showLoginTimers).toBe(false)
    expect(body.showTodayAtAGlance).toBe(false)
  })

  it("ignores values whose type does not match the setting", async () => {
    const body = await put({ enable3DCharts: "yes-please" })

    expect(body.enable3DCharts).toBe(DASHBOARD_SETTINGS_DEFAULTS.enable3DCharts)
  })

  it("ignores unknown keys rather than storing them", async () => {
    await put({ somethingNobodyDefined: true })

    expect(JSON.parse(written as string)).not.toHaveProperty("somethingNobodyDefined")
  })

  it("falls back to defaults when the stored JSON is corrupt", async () => {
    mockStoredRow("{not json")

    const body = await put({ enable3DCharts: false })

    expect(body.showLoginTimers).toBe(DASHBOARD_SETTINGS_DEFAULTS.showLoginTimers)
    expect(body.enable3DCharts).toBe(false)
  })

  it("returns 400 when the app has no settings row yet", async () => {
    vi.mocked(db.select).mockReturnValue({
      from: () => ({ limit: () => Promise.resolve([]) }),
    } as never)
    vi.mocked(parseJsonBody).mockResolvedValue({ enable3DCharts: false } as never)

    const res = await PUT(new Request("http://localhost/api/settings/dashboard", { method: "PUT" }))

    expect(res.status).toBe(400)
    expect(written).toBeNull()
  })
})
