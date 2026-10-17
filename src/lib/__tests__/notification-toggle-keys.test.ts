// src/lib/__tests__/notification-toggle-keys.test.ts
//
// The PATCH route writes only the keys it lists, so a notify column missing
// from that list is accepted by the client, updated optimistically in the UI,
// and silently never persisted. Deriving the expectation from the schema makes
// the next column added without a toggle key fail here.

import { describe, expect, it } from "vitest"
import { notificationTargets } from "@/lib/db/schema"
import { NOTIFY_TOGGLE_KEYS } from "@/lib/notifications/types"
import { notificationTargetColumns } from "@/lib/server-data"

describe("NOTIFY_TOGGLE_KEYS", () => {
  const schemaKeys = Object.keys(notificationTargets)
    .filter((k) => k.startsWith("notify"))
    .sort()

  it("finds the notify columns it is meant to mirror", () => {
    expect(schemaKeys.length).toBeGreaterThan(0)
  })

  it("covers every notify column on the notification targets table", () => {
    expect([...NOTIFY_TOGGLE_KEYS].sort()).toEqual(schemaKeys)
  })

  it("lists no key twice", () => {
    expect(new Set(NOTIFY_TOGGLE_KEYS).size).toBe(NOTIFY_TOGGLE_KEYS.length)
  })

  // Drizzle infers the row type from this object's keys, so it cannot be built
  // from the list above without losing the per-column types every caller reads.
  // It stays hand-written and is pinned here instead: a column absent from the
  // projection never reaches the settings sheet or a backup file.
  it("is mirrored by the notification target projection", () => {
    const projected = Object.keys(notificationTargetColumns)
      .filter((k) => k.startsWith("notify"))
      .sort()
    expect(projected).toEqual(schemaKeys)
  })
})
