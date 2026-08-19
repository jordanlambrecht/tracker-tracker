// src/data/tracker-credential-defaults.ts
//
// Which credential fields each tracker HAS, so a freshly opened vault sheet is
// pre-populated instead of blank.
//
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL BOUNDARY. READ BEFORE EDITING
//
// Everything in this file, and every `credentialFields` entry in src/data/trackers/**,
// is PUBLIC, git-committed data. It defines which fields EXIST. It must NEVER
// hold a user's actual VALUES.
//
// A contributor pasting their own API key or passkey into one of these entries
// would leak it into git history FOREVER. Rewriting history does not recall the
// clones, the forks, or the mirrors, and a private-tracker passkey is an account
// ban waiting to happen. The type system enforces this structurally:
// TrackerCredentialFieldDefinition has NO `value` property, so there is nowhere
// to put one. Do not add one. User values live only in the AES-256-GCM blob in
// `trackers.encrypted_credentials`.
// ─────────────────────────────────────────────────────────────────────────────
//
// Defaults are keyed by PLATFORM rather than by slug so that 56 tracker files do
// not each need editing. A single tracker overrides by setting `credentialFields`
// on its own registry entry; everything else falls through to its platform's list
// and then to the universal fallback.

import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { PlatformType } from "@/lib/adapters/constants"
import type { TrackerCredentialFieldDefinition } from "@/lib/tracker-credentials/types"

/**
 * The near-universal field. Almost every private tracker issues some per-user API
 * key, so this is what an unrecognised or `custom` platform starts with.
 */
export const UNIVERSAL_CREDENTIAL_FIELDS: readonly TrackerCredentialFieldDefinition[] = [
  { id: "api_key", label: "API key" },
]

/** The RSS/download passkey most trackers embed in announce and RSS URLs. */
const PASSKEY_FIELD: TrackerCredentialFieldDefinition = {
  id: "passkey",
  label: "Passkey",
  hint: "The per-user key embedded in announce and RSS URLs",
}

/**
 * IRC identity. The nick is NOT a secret. It is visible to every other user in
 * the channel, so it opts out explicitly. The NickServ password omits `secret`
 * and therefore defaults to secret, which is the fail-closed direction.
 */
const IRC_FIELDS: readonly TrackerCredentialFieldDefinition[] = [
  { id: "irc_nick", label: "IRC nick", secret: false },
  { id: "irc_nickserv", label: "NickServ password" },
]

export const PLATFORM_CREDENTIAL_FIELDS: Partial<
  Record<PlatformType, readonly TrackerCredentialFieldDefinition[]>
> = {
  unit3d: [{ id: "api_key", label: "API key" }, { id: "rss_key", label: "RSS key" }, PASSKEY_FIELD],
  gazelle: [{ id: "api_key", label: "API key" }, PASSKEY_FIELD, ...IRC_FIELDS],
  ggn: [{ id: "api_key", label: "API key" }, PASSKEY_FIELD, ...IRC_FIELDS],
  nebulance: [{ id: "api_key", label: "API key" }, PASSKEY_FIELD],
  mam: [
    {
      id: "mam_id",
      label: "mam_id session cookie",
      hint: "Preferences → Security → session cookie",
    },
    PASSKEY_FIELD,
  ],
  avistaz: [{ id: "api_key", label: "API key" }, { id: "pid", label: "PID" }, PASSKEY_FIELD],
  digitalcore: [{ id: "api_key", label: "API key" }, PASSKEY_FIELD],
  btn: [{ id: "api_key", label: "API key" }, PASSKEY_FIELD, ...IRC_FIELDS],
  iptorrents: [
    { id: "session_cookie", label: "Session cookie" },
    PASSKEY_FIELD,
    { id: "rss_feed_url", label: "RSS feed URL", secret: false },
  ],
  torrentleech: [{ id: "session_cookie", label: "Session cookie" }, PASSKEY_FIELD],
  // `custom` is deliberately absent. It falls through to the universal fallback,
  // which is the only honest default for a tracker we know nothing about.
}

/**
 * Resolve the starting field definitions for a tracker: its own override, else
 * its platform's list, else the universal fallback.
 *
 * Deliberately NOT a merge. A tracker that sets `credentialFields` is stating the
 * complete list for itself; silently unioning it with the platform defaults would
 * make it impossible to REMOVE a field that a platform generally has but this
 * tracker does not issue.
 *
 * These are only seeds for a new vault. Once a user has saved a vault, their
 * sections and fields are authoritative and this is not consulted again.
 */
export function getDefaultCredentialFields(
  entry: Pick<TrackerRegistryEntry, "platform" | "credentialFields">
): readonly TrackerCredentialFieldDefinition[] {
  return (
    entry.credentialFields ??
    PLATFORM_CREDENTIAL_FIELDS[entry.platform] ??
    UNIVERSAL_CREDENTIAL_FIELDS
  )
}
