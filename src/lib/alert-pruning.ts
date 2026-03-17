// src/lib/alert-pruning.ts
//
// Functions: pruneDismissedAlerts
// Constants: EXPIRING_ALERT_TYPES, NON_DISMISSIBLE_ALERT_TYPES, ALERT_EXPIRY_MS

import { and, inArray, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { dismissedAlerts } from "@/lib/db/schema"

export const EXPIRING_ALERT_TYPES = ["stale-data", "zero-seeding"]
export const NON_DISMISSIBLE_ALERT_TYPES = new Set(["client-error"])
export const ALERT_EXPIRY_MS = 24 * 60 * 60 * 1000

export async function pruneDismissedAlerts(): Promise<void> {
  const cutoff = new Date(Date.now() - ALERT_EXPIRY_MS)
  await db
    .delete(dismissedAlerts)
    .where(
      and(
        inArray(dismissedAlerts.alertType, EXPIRING_ALERT_TYPES),
        lt(dismissedAlerts.dismissedAt, cutoff)
      )
    )
}
