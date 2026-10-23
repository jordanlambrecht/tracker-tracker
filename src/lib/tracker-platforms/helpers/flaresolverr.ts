// src/lib/tracker-platforms/helpers/flaresolverr.ts
//
// Functions: solverCall, createSolverSession, destroySolverSession, toResult, solverGet, escapeHtml,
//            formPageUrl, solverPostForm, unwrapSolverJson, cookieHeaderToSolverCookies,
//            solverReady, solverClearance

import { randomUUID } from "node:crypto"
import { classifyFetchError } from "@/lib/error-utils"
import type { FlareSolverrConfig } from "../contract"

// FlareSolverr client. FlareSolverr loads pages in a real browser that solves
// Cloudflare challenges. The browser sends its own User-Agent, and the response
// contains the rendered page, already decoded to text.

/** Added to FlareSolverr's maxTimeout so that its own timeout error is returned first. */
const CALL_TIMEOUT_MARGIN_MS = 15_000

export interface SolverCookie {
  name: string
  value: string
  domain?: string
}

export interface SolverResult {
  /** Where the browser ended up, after any redirects it followed */
  url: string
  status: number
  /** The rendered page */
  html: string
  cookies: SolverCookie[]
}

interface SolverResponse {
  status?: string
  message?: string
  solution?: {
    url?: string
    status?: number
    response?: string
    cookies?: { name?: unknown; value?: unknown; domain?: unknown }[]
  }
}

/**
 * One call to `POST /v1`. `redact` is removed from any message that is
 * returned, since a form submission contains its fields in the URL.
 */
async function solverCall(
  config: FlareSolverrConfig,
  payload: Record<string, unknown>,
  redact: string[] = []
): Promise<SolverResponse> {
  const endpoint = new URL("/v1", config.url)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.maxTimeout + CALL_TIMEOUT_MARGIN_MS),
    })
  } catch (err) {
    throw new Error(
      `FlareSolverr unreachable: ${classifyFetchError(err, endpoint.hostname).message}`
    )
  }

  let data: SolverResponse | null = null
  try {
    data = (await response.json()) as SolverResponse
  } catch {
    data = null
  }
  if (!response.ok || data?.status !== "ok") {
    let message = typeof data?.message === "string" && data.message ? data.message : ""
    for (const secret of redact) if (secret) message = message.split(secret).join("…")
    throw new Error(`FlareSolverr: ${message || `HTTP ${response.status}`}`)
  }
  return data
}

/** A browser session, in which cookies such as cf_clearance persist between requests. */
export async function createSolverSession(config: FlareSolverrConfig): Promise<string> {
  const session = `tracker-tracker-${randomUUID()}`
  await solverCall(config, { cmd: "sessions.create", session })
  return session
}

/** Best-effort. Each FlareSolverr session has an open browser until the session is destroyed. */
export async function destroySolverSession(
  config: FlareSolverrConfig,
  session: string
): Promise<void> {
  try {
    await solverCall(config, { cmd: "sessions.destroy", session })
  } catch {
    // A failure leaves the session open in FlareSolverr; the poll result is unaffected.
  }
}

function toResult(data: SolverResponse, requestedUrl: string, redact: string[]): SolverResult {
  const solution = data.solution
  if (!solution || typeof solution.response !== "string") {
    throw new Error(`FlareSolverr: no page in the reply for ${new URL(requestedUrl).hostname}`)
  }
  let url = typeof solution.url === "string" && solution.url ? solution.url : requestedUrl
  for (const secret of redact) if (secret && url.includes(secret)) url = requestedUrl
  return {
    url,
    status: typeof solution.status === "number" ? solution.status : 200,
    html: solution.response,
    cookies: (solution.cookies ?? [])
      .filter((c) => typeof c.name === "string" && typeof c.value === "string")
      .map((c) => ({
        name: c.name as string,
        value: c.value as string,
        ...(typeof c.domain === "string" ? { domain: c.domain } : {}),
      })),
  }
}

export async function solverGet(
  config: FlareSolverrConfig,
  url: string,
  options: { session?: string; cookies?: SolverCookie[] } = {}
): Promise<SolverResult> {
  const data = await solverCall(config, {
    cmd: "request.get",
    url,
    maxTimeout: config.maxTimeout,
    disableMedia: true,
    ...(options.session ? { session: options.session } : {}),
    ...(options.cookies?.length ? { cookies: options.cookies } : {}),
  })
  return toResult(data, url, [])
}

/**
 * Solves the site's challenge in a throwaway browser and returns its
 * cf_clearance cookie. FlareSolverr solves a challenge in about 15 s this way
 * but takes about 60 s inside a session, so a session is seeded with this
 * cookie instead of solving the challenge itself.
 */
export async function solverClearance(
  config: FlareSolverrConfig,
  url: string
): Promise<SolverCookie[]> {
  const result = await solverGet(config, url)
  return result.cookies
    .filter((c) => c.name === "cf_clearance")
    .map((c) => ({ name: c.name, value: c.value }))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
}

/**
 * A page that submits the form as soon as it loads. FlareSolverr's own
 * `request.post` percent-encodes every value a second time, so a password
 * with a symbol in it would arrive altered; a form the browser submits is
 * encoded once, in the charset the site expects.
 */
export function formPageUrl(
  action: string,
  fields: Record<string, string>,
  charset: string
): string {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`
    )
    .join("")
  const page =
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>` +
    `<form id="f" method="post" action="${escapeHtml(action)}" accept-charset="${escapeHtml(charset)}">${inputs}</form>` +
    `<script>document.getElementById("f").submit()</script></body></html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(page)}`
}

/** POSTs a form through the browser. The field values never appear in an error. */
export async function solverPostForm(
  config: FlareSolverrConfig,
  action: string,
  fields: Record<string, string>,
  options: { session?: string; charset?: string } = {}
): Promise<SolverResult> {
  const url = formPageUrl(action, fields, options.charset ?? "utf-8")
  const redact = [url, ...Object.values(fields).filter((v) => v.length >= 4)]
  const data = await solverCall(
    config,
    {
      cmd: "request.get",
      url,
      maxTimeout: config.maxTimeout,
      disableMedia: true,
      ...(options.session ? { session: options.session } : {}),
    },
    redact
  )
  return toResult(data, action, redact)
}

/**
 * The browser shows a JSON reply as a page with the text in one `<pre>`. Text
 * that is not such a page is returned as it is.
 */
export function unwrapSolverJson(html: string): string {
  const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
  if (!match) return html
  return match[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

/** A `Cookie` header value as FlareSolverr cookie objects. */
export function cookieHeaderToSolverCookies(header: string): SolverCookie[] {
  return header
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair.includes("="))
    .map((pair) => {
      const at = pair.indexOf("=")
      return { name: pair.slice(0, at).trim(), value: pair.slice(at + 1).trim() }
    })
    .filter((cookie) => cookie.name)
}

/**
 * FlareSolverr's index returns `{msg: "FlareSolverr is ready!", version}` once its browser is up.
 * Returns the version, or throws with the reason it is not ready.
 */
export async function solverReady(url: string, timeoutMs: number): Promise<string> {
  const endpoint = new URL("/", url)
  let response: Response
  try {
    response = await fetch(endpoint, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    throw new Error(
      `FlareSolverr unreachable: ${classifyFetchError(err, endpoint.hostname).message}`
    )
  }
  let data: { msg?: unknown; version?: unknown } | null = null
  try {
    data = (await response.json()) as { msg?: unknown; version?: unknown }
  } catch {
    data = null
  }
  if (!response.ok || typeof data?.msg !== "string" || !/ready/i.test(data.msg)) {
    throw new Error(`No FlareSolverr at this URL (HTTP ${response.status})`)
  }
  return typeof data.version === "string" ? data.version.slice(0, 32) : ""
}
