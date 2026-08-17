// src/app/api/trackers/[id]/credentials/route.ts
//
// Functions: GET, PUT
//
// The tracker credential vault. GET loads the sheet WITHOUT any secret
// plaintext; PUT replaces the whole vault. Secret values leave the server by
// exactly one route, ./reveal, and never by this one.
//
// Both handlers sit behind authenticate() AND the credential-vault opt-in gate.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  parseTrackerId,
  type RouteContext,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { decryptTrackerCredentials } from "@/lib/tracker-credentials/decrypt"
import { requireCredentialVaultEnabled } from "@/lib/tracker-credentials/gate"
import {
  isTrackerCredentialVaultInput,
  mergeVaultInput,
} from "@/lib/tracker-credentials/merge"
import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"
import { validateTrackerCredentialVault } from "@/lib/tracker-credentials/validate"
import { toVaultView } from "@/lib/tracker-credentials/view"

export async function GET(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const gated = await requireCredentialVaultEnabled()
  if (gated) return gated

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  // Explicit projection: encryptedApiToken is NOT selected. It has no business
  // in this handler and cannot leak from a variable that was never read.
  const [tracker] = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      encryptedCredentials: trackers.encryptedCredentials,
    })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) return NextResponse.json({ error: "Tracker not found" }, { status: 404 })

  // NULL is "no vault" — a normal state, not an error, and never handed to
  // decrypt(). The sheet seeds an empty vault from the registry defaults.
  if (!tracker.encryptedCredentials) {
    return NextResponse.json({ vault: null })
  }

  const key = decodeKey(auth)
  try {
    const vault = decryptTrackerCredentials(
      { name: tracker.name, encryptedCredentials: tracker.encryptedCredentials },
      key
    )
    // toVaultView drops every secret value STRUCTURALLY — the view type has no
    // `value` property on a secret field, so this response cannot carry one.
    return NextResponse.json({ vault: toVaultView(vault) })
  } catch (err) {
    // decryptTrackerCredentials already collapses crypto and parse failures into
    // one generic message, so errMsg here cannot leak an oracle or a plaintext
    // fragment.
    log.error(
      { route: "GET /api/trackers/[id]/credentials", trackerId, error: errMsg(err) },
      "Failed to read tracker credential vault"
    )
    return NextResponse.json({ error: "Failed to read stored credentials" }, { status: 500 })
  } finally {
    key.fill(0)
  }
}

export async function PUT(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const gated = await requireCredentialVaultEnabled()
  if (gated) return gated

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const [tracker] = await db
    .select({
      id: trackers.id,
      name: trackers.name,
      encryptedCredentials: trackers.encryptedCredentials,
    })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)
  if (!tracker) return NextResponse.json({ error: "Tracker not found" }, { status: 404 })

  const vault = body.vault

  // An explicit null, or a vault with nothing left in it, clears the column.
  // Storing encrypt('{"v":1,"sections":[]}') instead would give "no vault" TWO
  // representations, and every reader would then have to know both. NULL is the
  // single empty state — see the column's doc comment in schema.ts.
  const isEmpty =
    vault === null ||
    (typeof vault === "object" &&
      vault !== null &&
      Array.isArray((vault as { sections?: unknown }).sections) &&
      (vault as { sections: unknown[] }).sections.length === 0)

  // Clearing needs no key and no merge: there is nothing to carry forward.
  if (isEmpty) {
    return writeVault(trackerId, null)
  }

  if (!isTrackerCredentialVaultInput(vault)) {
    return NextResponse.json(
      { error: "Credential vault must be a version 1 object with a sections array" },
      { status: 400 }
    )
  }

  const key = decodeKey(auth)
  try {
    // ── The merge, and why the failure below is a refusal rather than a fallback
    //
    // The sheet loads MASKED, so it cannot send back secrets it was never shown;
    // fields arrive with `value` OMITTED to mean "keep what is stored". Filling
    // those gaps requires reading the current vault. If that read fails, the ONLY
    // safe move is to abort: treating an unreadable vault as empty would merge
    // every omitted value to "" and silently destroy every secret in it, and the
    // user would see a green "Saved".
    let existing: TrackerCredentialVault | null = null
    if (tracker.encryptedCredentials) {
      try {
        existing = decryptTrackerCredentials(
          { name: tracker.name, encryptedCredentials: tracker.encryptedCredentials },
          key
        )
      } catch (err) {
        log.error(
          { route: "PUT /api/trackers/[id]/credentials", trackerId, error: errMsg(err) },
          "Refused to save: existing credential vault could not be read for merge"
        )
        return NextResponse.json(
          {
            error:
              "Could not read the stored credentials to preserve your unchanged values, so nothing was saved. Clear the vault and re-enter it to start fresh.",
          },
          { status: 500 }
        )
      }
    }

    const merged = mergeVaultInput(vault, existing)

    // Validation runs on the MERGED vault, not the input — the limits have to be
    // enforced against the bytes that are actually about to be encrypted, and an
    // input with every value omitted is far smaller than what it merges into.
    const invalid = validateTrackerCredentialVault(merged)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    return writeVault(trackerId, encrypt(JSON.stringify(merged), key))
  } catch (err) {
    log.error(
      { route: "PUT /api/trackers/[id]/credentials", trackerId, error: errMsg(err) },
      "Failed to save tracker credential vault"
    )
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 })
  } finally {
    key.fill(0)
  }
}

/**
 * The single write point, so the NULL-or-ciphertext invariant is decided in one
 * place rather than at each of the two call sites.
 */
async function writeVault(trackerId: number, ciphertext: string | null) {
  try {
    await db
      .update(trackers)
      .set({ encryptedCredentials: ciphertext, updatedAt: new Date() })
      .where(eq(trackers.id, trackerId))

    // Never an id, a label or a value: this line lands in the log file the events
    // tab reads.
    log.info(
      { route: "PUT /api/trackers/[id]/credentials", trackerId, cleared: ciphertext === null },
      ciphertext === null ? "cleared tracker credential vault" : "saved tracker credential vault"
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    log.error(
      { route: "PUT /api/trackers/[id]/credentials", trackerId, error: errMsg(err) },
      "Failed to save tracker credential vault"
    )
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 })
  }
}
