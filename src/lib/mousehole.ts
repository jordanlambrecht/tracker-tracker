// src/lib/mousehole.ts
//
// Functions: stripUrlCredentials, mouseholeStatus
// Constants: MOUSEHOLE_URL_PLACEHOLDER, MOUSEHOLE_URL_TIP, MOUSEHOLE_TOKEN_TIP

export type MouseholeResult =
  "ok" | "throttled" | "no-cookie" | "pending" | "rejected" | "unreachable"

export interface MouseholeStatusResponse {
  result: MouseholeResult | null
  hasCookie: boolean | null
  ip: string | null
  asn: number | null
  asOrg: string | null
  nextContactAt: string | null
  lastContactAt: string | null
  lastMessage: string | null
  stateError: string | null
}

export const MOUSEHOLE_URL_PLACEHOLDER = "http://mousehole:5010"

export const MOUSEHOLE_URL_TIP =
  "If you run Mousehole to manage your MAM seedbox IP, enter its URL here to see status and trigger updates from Tracker Tracker. Needs Mousehole v0.5.0 or newer. Use a container or host name, since localhost and private IP addresses are refused, and add that name to MOUSEHOLE_ALLOWED_HOSTS on Mousehole. Setting that variable replaces Mousehole's localhost default, so keep localhost in it if you open the web UI that way."

export const MOUSEHOLE_TOKEN_TIP =
  "Set MOUSEHOLE_AUTH_TOKEN on Mousehole to a long random value, restart it, and enter the same value here. Mousehole's API never accepts the web UI password. Stored encrypted and never shown again."

/**
 * The save paths refuse userinfo, so this covers only a row stored before
 * that refusal. Without it such a row's link would carry the token. A string
 * strip rather than new URL(), because it runs in the browser on whatever the
 * row holds and the href must never throw. The authority ends at the first
 * /, \, ? or #, so an @ in a path, query or fragment is left alone.
 */
export function stripUrlCredentials(raw: string): string {
  return raw.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/\\?#]*@/i, "$1").replace(/\/+$/, "")
}

export function mouseholeStatus(result: string | null): {
  label: string
  tone: "success" | "warn" | "danger"
} {
  switch (result) {
    case "ok":
      return { label: "OK", tone: "success" }
    case "throttled":
      return { label: "Throttled", tone: "warn" }
    case "no-cookie":
      return { label: "No cookie", tone: "warn" }
    case "pending":
      return { label: "Pending", tone: "warn" }
    case "rejected":
      return { label: "Rejected", tone: "danger" }
    case "unreachable":
      return { label: "Unreachable", tone: "danger" }
    default:
      return { label: "Down", tone: "danger" }
  }
}
