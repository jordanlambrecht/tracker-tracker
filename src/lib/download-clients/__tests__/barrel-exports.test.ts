// src/lib/download-clients/__tests__/barrel-exports.test.ts
//
// Verifies the barrel export surface does not leak internal credential types.

import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/db/schema", () => ({
  downloadClients: {},
  trackers: {},
  appSettings: {},
  clientSnapshots: {},
  notificationTargets: {},
}))
vi.mock("@/lib/crypto", () => ({ encrypt: vi.fn(), decrypt: vi.fn() }))
vi.mock("@/lib/error-utils", () => ({
  isDecryptionError: vi.fn(),
  sanitizeNetworkError: vi.fn(),
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/fleet", () => ({
  parseTorrentTags: vi.fn(),
  SEEDING_STATES: new Set(),
  LEECHING_STATES: new Set(),
}))
vi.mock("@/lib/fleet-aggregation", () => ({ computeFleetAggregation: vi.fn() }))
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), isNotNull: vi.fn() }))

describe("download-clients barrel exports", () => {
  it("does not export DownloadClientRow as a runtime value", async () => {
    const barrel = await import("../index")
    const exportedKeys = Object.keys(barrel)
    expect(exportedKeys).not.toContain("DownloadClientRow")
  })

  it("does not export tryDecryptClientCredentials", async () => {
    const barrel = await import("../index")
    const exportedKeys = Object.keys(barrel)
    expect(exportedKeys).not.toContain("tryDecryptClientCredentials")
  })

  it("does not export createClientAdapter (internal only)", async () => {
    const barrel = await import("../index")
    const exportedKeys = Object.keys(barrel)
    expect(exportedKeys).not.toContain("createClientAdapter")
  })

  it("exports safety-critical functions", async () => {
    const barrel = await import("../index")
    expect(typeof barrel.stripSensitiveTorrentFields).toBe("function")
    expect(typeof barrel.assertClientType).toBe("function")
    expect(typeof barrel.createAdapterForClient).toBe("function")
  })
})
