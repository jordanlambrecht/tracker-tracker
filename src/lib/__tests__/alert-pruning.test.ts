// src/lib/__tests__/alert-pruning.test.ts
//
// pruneDismissedAlerts deletes a dismissal of an expiring type once it is older
// than ALERT_EXPIRY_MS. The where clause is tagged, as in prowlarr-sync.test.ts,
// and read against rows to see which ones the delete is limited to.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { where } = vi.hoisted(() => ({ where: vi.fn() }))

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
  lt: vi.fn((...args: unknown[]) => ({ op: "lt", args })),
}))
vi.mock("@/lib/db/schema", () => ({
  dismissedAlerts: { alertType: "alertType", dismissedAt: "dismissedAt" },
}))
vi.mock("@/lib/db", () => ({ db: { delete: vi.fn(() => ({ where })) } }))

import { ALERT_EXPIRY_MS, pruneDismissedAlerts } from "@/lib/alert-pruning"

interface Row {
  alertKey: string
  alertType: string
  dismissedAt: Date
}
interface Cond {
  op: string
  args: unknown[]
}

/** Whether the tagged where clause selects the row for deletion. */
function selects(cond: Cond, row: Row): boolean {
  if (cond.op === "and") return (cond.args as Cond[]).every((c) => selects(c, row))
  const [column, value] = cond.args as [keyof Row, unknown]
  if (cond.op === "inArray") return (value as unknown[]).includes(row[column])
  if (cond.op === "lt") return (row[column] as Date) < (value as Date)
  throw new Error(`Unexpected operator ${cond.op}`)
}

const NOW = new Date("2026-10-28T12:00:00Z").getTime()

describe("pruneDismissedAlerts", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    where.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // The key names only the client, so a dismissal that never expired would
  // hide every later deep-poll failure on that client too.
  it("prunes a client-warning dismissal older than ALERT_EXPIRY_MS and keeps a newer one", async () => {
    const old: Row = {
      alertKey: "client-warning-1",
      alertType: "client-warning",
      dismissedAt: new Date(NOW - ALERT_EXPIRY_MS - 1),
    }
    const recent: Row = {
      alertKey: "client-warning-2",
      alertType: "client-warning",
      dismissedAt: new Date(NOW - ALERT_EXPIRY_MS + 60_000),
    }

    await pruneDismissedAlerts()

    expect(where).toHaveBeenCalledOnce()
    const cond = where.mock.calls[0][0] as Cond
    expect(selects(cond, old)).toBe(true)
    expect(selects(cond, recent)).toBe(false)
  })
})
