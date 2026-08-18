// src/lib/__tests__/tracker-credential-null-invariant.test.ts
//
// trackers.encrypted_credentials is NULL OR CIPHERTEXT. NOTHING ELSE.
//
// These two destructive paths are where that invariant is easiest to break,
// because the column sitting next to it breaks it on purpose:
//   - nuke.ts scrubs encrypted_api_token to randomHex(64)
//   - the lockdown route sets encrypted_api_token to the literal
//     "LOCKDOWN_REVOKED"
// Both are forced moves. That column is NOT NULL, so it needs *some* string.
// encrypted_credentials IS nullable, so copying either idiom would put a TRUTHY
// NON-CIPHERTEXT value in a column that guards read with
// `if (row.encryptedCredentials)`. That is exactly how "LOCKDOWN_REVOKED" once
// reached decrypt(). These tests fail if anyone ever copies the neighbour.

import { beforeEach, describe, expect, it, vi } from "vitest"

type Write = { table: unknown; values: Record<string, unknown> }
let writes: Write[]

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}))

// Identity-only stand-ins: the assertions key off object identity, so the
// values just have to be distinct references.
vi.mock("@/lib/db/schema", () => ({
  appSettings: { id: "appSettings.id" },
  trackers: { id: "trackers.id" },
  trackerSnapshots: {},
  trackerRoles: {},
  downloadClients: {},
  notificationTargets: {},
  notificationDeliveryState: {},
  dismissedAlerts: {},
  tagGroups: {},
  tagGroupMembers: {},
  clientSnapshots: {},
  clientUptimeBuckets: {},
  torrentDailyCheckpoints: {},
  trackerDailyCheckpoints: {},
  appLiveness: {},
  appCoverageGaps: {},
}))

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock("@/lib/scheduler", () => ({ stopScheduler: vi.fn(), ensureSchedulerRunning: vi.fn() }))
vi.mock("@/lib/scheduler-key-store", () => ({ clearSchedulerKey: vi.fn() }))
vi.mock("@/lib/app-liveness", () => ({ clearAppLivenessState: vi.fn() }))
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  verifyPassword: vi.fn().mockResolvedValue(true),
  clearSession: vi.fn(),
}))
vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-helpers")>()
  return {
    ...actual,
    authenticate: vi.fn().mockResolvedValue({ encryptionKey: "00".repeat(32) }),
    parseJsonBody: vi.fn().mockResolvedValue({ password: "master-password" }),
  }
})

import { POST as LockdownPOST } from "@/app/api/settings/lockdown/route"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { scrubAndDeleteAll } from "@/lib/nuke"

/** The value written to the vault column by the run under test. */
function trackerVaultWrite(): Record<string, unknown> {
  const found = writes.filter((w) => w.table === trackers)
  expect(found).toHaveLength(1)
  return found[0].values
}

beforeEach(() => {
  vi.clearAllMocks()
  writes = []
  ;(db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => ({ limit: () => Promise.resolve([{ id: 1, passwordHash: "hash" }]) }),
  })
  ;(db.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => {
            const done = Promise.resolve([])
            writes.push({ table, values })
            // nuke calls .set() bare; lockdown chains .where(). Both resolve.
            return Object.assign(done, { where: () => done })
          },
        }),
        delete: () => Promise.resolve([]),
      }
      return cb(tx)
    }
  )
})

describe("emergency lockdown — trackers.encryptedCredentials", () => {
  it("writes NULL, never the 'LOCKDOWN_REVOKED' marker used for the API token", async () => {
    const response = await LockdownPOST(
      new Request("http://localhost/api/settings/lockdown", { method: "POST" })
    )
    expect(response.status).toBe(200)

    const values = trackerVaultWrite()

    // The column is included in the revoke at all. An omitted column would
    // leave a live, decryptable vault behind after an emergency lockdown.
    expect(values).toHaveProperty("encryptedCredentials")
    expect(values.encryptedCredentials).toBeNull()

    // Explicitly NOT the neighbour's marker. This is the exact literal that
    // once sailed past a truthiness guard into decrypt().
    expect(values.encryptedCredentials).not.toBe("LOCKDOWN_REVOKED")
    // And the neighbour is unchanged, so this test cannot pass by accident
    // because someone dropped the marker everywhere.
    expect(values.encryptedApiToken).toBe("LOCKDOWN_REVOKED")
  })
})

describe("nuke — trackers.encryptedCredentials", () => {
  it("scrubs to NULL, never to a random hex blob", async () => {
    await scrubAndDeleteAll()

    const values = trackerVaultWrite()

    expect(values).toHaveProperty("encryptedCredentials")
    expect(values.encryptedCredentials).toBeNull()

    // The API token beside it IS a random blob, because it is NOT NULL and so
    // has no choice. Asserting both in one place is the point: it documents
    // why the two columns legitimately differ.
    expect(typeof values.encryptedApiToken).toBe("string")
    expect(values.encryptedApiToken).toMatch(/^[0-9a-f]{128}$/)
  })
})
