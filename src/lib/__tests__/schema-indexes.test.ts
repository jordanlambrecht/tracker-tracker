// src/lib/__tests__/schema-indexes.test.ts
//
// Functions: (test file)

import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { clientSnapshots, trackerRoles, trackerSnapshots } from "@/lib/db/schema"

describe("schema indexes", () => {
  it("trackerSnapshots has composite index on (trackerId, polledAt)", () => {
    const config = getTableConfig(trackerSnapshots)
    const idx = config.indexes.find((i) => i.config.name === "idx_snapshots_tracker_polled")
    expect(idx).toBeDefined()
  })

  it("trackerSnapshots has BRIN index on polledAt", () => {
    const config = getTableConfig(trackerSnapshots)
    const idx = config.indexes.find((i) => i.config.name === "idx_snapshots_polled_brin")
    expect(idx).toBeDefined()
  })

  it("clientSnapshots has composite index on (clientId, polledAt)", () => {
    const config = getTableConfig(clientSnapshots)
    const idx = config.indexes.find((i) => i.config.name === "idx_client_snapshots_client_polled")
    expect(idx).toBeDefined()
  })

  it("trackerRoles has index on trackerId", () => {
    const config = getTableConfig(trackerRoles)
    const idx = config.indexes.find((i) => i.config.name === "idx_tracker_roles_tracker_id")
    expect(idx).toBeDefined()
  })
})
