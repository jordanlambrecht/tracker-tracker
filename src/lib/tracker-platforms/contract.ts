// src/lib/tracker-platforms/contract.ts
//
// The contract an adapter implements. The shapes it returns live in
// @/types/tracker-stats, which has no imports and is safe to read from a
// component; everything here is server-side.

import type { Agent as HttpAgent } from "node:http"
import type { GazelleAuthStyle, NebulanceAuthParam, Unit3dAuthStyle } from "@/data/platform-types"
import type { DebugApiCall, TrackerPollResult } from "@/types/tracker-stats"

export type { GazelleAuthStyle, NebulanceAuthParam, Unit3dAuthStyle } from "@/data/platform-types"
// The shapes an adapter returns live in @/types/tracker-stats so a component
// can read them without importing this module. Re-exported here so an
// adapter still takes its contract from one import.
export type * from "@/types/tracker-stats"

export interface FetchOptions {
  proxyAgent?: HttpAgent
  remoteUserId?: number
  authStyle?: GazelleAuthStyle
  unit3dAuthStyle?: Unit3dAuthStyle
  nebulanceAuthParam?: NebulanceAuthParam
  enrich?: boolean
}

/** A captcha that has to be answered before the account can log in. */
export interface PendingCaptcha {
  /** Where the image is, on the tracker's own or its static host */
  imageUrl: string
  /** ISO 8601. After this the captcha is removed and the next poll gets a new one. */
  expiresAt: string
}

export interface TrackerAdapter {
  fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerPollResult>
  fetchRaw(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<DebugApiCall[]>
  /**
   * For trackers whose login can require a captcha: returns the pending captcha,
   * or null. A poll that gets a captcha stores it as pending and fails until the
   * captcha is answered.
   */
  pendingCaptcha?(baseUrl: string, apiToken: string): Promise<PendingCaptcha | null>
  /**
   * Logs in with the answer to the pending captcha. Throws when there is none,
   * when the answer is wrong (a new captcha is then pending) or the login fails.
   */
  submitCaptcha?(
    baseUrl: string,
    apiToken: string,
    answer: string,
    options?: FetchOptions
  ): Promise<void>
}
