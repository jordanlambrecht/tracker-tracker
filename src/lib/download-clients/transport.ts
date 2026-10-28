// src/lib/download-clients/transport.ts
//
// Transport helpers every download client shares.
//
// Available functions:
//   describeFetchError    - Detail string from a fetch rejection
//   buildBaseUrl          - Construct base URL from host/port/ssl/URL path
//   fetchSignal           - The caller's deadline combined with the transport ceiling
//   credentialFingerprint - Non-reversible hash identifying some secret material
//   blockKeyFor           - Compose the auth-block map key from baseUrl + fingerprint
//   getAuthBlock          - The rejection recorded under a block key, if any
//   setAuthBlock          - Record a rejection so it is replayed instead of retried
//   clearAuthBlocks       - Drop auth blocks for one baseUrl (explicit user retry)
//   clearAllAuthBlocks    - Drop every auth block (called when the scheduler stops)
//   readCappedBody        - Read a body stream, refusing one past a byte limit
//   readCappedText        - readCappedBody for the reads that want text
//   readCappedJson        - readCappedBody parsed as JSON
//   isResponseTooLarge    - True for readCappedBody's size refusal
//   rethrowRefusal        - Catch handler that lets a size refusal through

import { createHash } from "node:crypto"
import { sanitizeHost } from "@/lib/data-transforms"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"

// Extract detail string from a fetch error.
export function describeFetchError(err: unknown): string {
  const cause =
    err !== null && typeof err === "object" && "cause" in (err as object)
      ? (err as { cause: unknown }).cause
      : undefined
  if (cause instanceof Error) {
    const code = "code" in cause ? (cause as NodeJS.ErrnoException).code : undefined
    if (code) return code
    if (cause.message) return cause.message
  }

  if (err instanceof Error) {
    const code = "code" in err ? (err as NodeJS.ErrnoException).code : undefined
    if (code) return code
    // A bare TypeError from fetch is either the useless "fetch failed" or
    // undici's header validation, which quotes the header and so the API key.
    // Neither message is worth logging; the name is.
    if (err instanceof TypeError)
      return err.message === "fetch failed" ? "Unknown network error" : err.name
    if (err.message) return err.message
  }

  return "Unknown network error"
}

export function buildBaseUrl(host: string, port: number, ssl: boolean, urlPath: string): string {
  // Strip any protocol the user may have included (i.e "http://myhost")
  const cleanHost = sanitizeHost(host)
  // The routes store the path validated and without a trailing slash, so it is
  // appended as is.
  return `${ssl ? "https" : "http"}://${cleanHost}:${port}${urlPath}`
}

/**
 * The caller's deadline and this transport's own ceiling, whichever fires
 * first. Without the caller's signal, a client past its deadline is abandoned
 * rather than cancelled and keeps its socket and response buffer open.
 */
export function fetchSignal(signal?: AbortSignal): AbortSignal {
  return signal
    ? AbortSignal.any([signal, AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS)])
    : AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS)
}

// ---------------------------------------------------------------------------
// Auth blocks. A credential the client rejected is replayed instead of sent
// again. Each client's transport says why it needs this.
// ---------------------------------------------------------------------------

const gBlocks = globalThis as typeof globalThis & {
  __clientAuthBlocks?: Map<string, string>
}
if (!gBlocks.__clientAuthBlocks) gBlocks.__clientAuthBlocks = new Map()
/** Maps `${baseUrl}\u0000${credentialFingerprint}` to the error message to replay. */
const authBlocks = gBlocks.__clientAuthBlocks

/**
 * Non-reversible identifier for a credential pair. Only ever compared, never
 * logged or persisted, it exists so a credential edit is detectable without
 * holding the plaintext.
 *
 * SHA-256 is deliberate. Do not swap in a slow KDF. The digest keys an
 * in-memory Map in a process that already holds the plaintext, and blockKeyFor
 * runs on the request path, so a slow KDF adds per-request cost and protects
 * nothing. The CodeQL insufficient-effort alert on this was reviewed and
 * dismissed as a false positive.
 */
function credentialFingerprint(username: string, password: string): string {
  return createHash("sha256").update(`${username}\u0000${password}`).digest("hex")
}

export function blockKeyFor(baseUrl: string, username: string, password: string): string {
  return `${baseUrl}\u0000${credentialFingerprint(username, password)}`
}

export function getAuthBlock(blockKey: string): string | undefined {
  return authBlocks.get(blockKey)
}

export function setAuthBlock(blockKey: string, message: string): void {
  authBlocks.set(blockKey, message)
}

/**
 * Drop every auth block recorded for a baseUrl regardless of credentials.
 * Called when the user explicitly asks to test the connection, an explicit
 * retry should always reach the network, since the fix may have been on the
 * client's side.
 */
export function clearAuthBlocks(baseUrl: string): void {
  const prefix = `${baseUrl}\u0000`
  for (const key of authBlocks.keys()) {
    if (key.startsWith(prefix)) authBlocks.delete(key)
  }
}

export function clearAllAuthBlocks(): void {
  authBlocks.clear()
}

/**
 * A body that ran past the cap, as a type rather than a recognisable string:
 * a caller that swallows a read that merely failed must not swallow this one.
 */
class ResponseTooLargeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ResponseTooLargeError"
  }
}

/**
 * Read a response body, refusing one that runs past maxBytes. The timeout
 * bounds how long a host may take, not how much it may send, so without the cap
 * a slow endless body is read into memory unbounded.
 *
 * Returns null when the response carries no stream: nothing to read
 * incrementally, nothing to cap, so the caller's own reader handles it.
 */
async function readCappedBody(
  response: Response,
  host: string,
  maxBytes: number
): Promise<string | null> {
  const body = response.body
  if (!body || typeof body.getReader !== "function") return null

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.length
      if (total > maxBytes) {
        await reader.cancel()
        throw new ResponseTooLargeError(
          `Response from ${host} exceeded ${maxBytes} bytes and was refused`
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  // TextDecoder runs the same UTF-8 decode as response.text() and
  // response.json(), which drops a leading BOM. Buffer.toString("utf8") keeps
  // it and JSON.parse rejects it, so a host that emits one fails every poll.
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export async function readCappedText(
  response: Response,
  host: string,
  maxBytes: number
): Promise<string> {
  return (await readCappedBody(response, host, maxBytes)) ?? (await response.text())
}

export async function readCappedJson<T>(
  response: Response,
  host: string,
  maxBytes: number
): Promise<T> {
  const text = await readCappedBody(response, host, maxBytes)
  if (text === null) return (await response.json()) as T
  // security-audit-ignore: readCappedBody bounded the body, and a parse failure rejects into the poll's own catch
  return JSON.parse(text) as T
}

/** Lets a client reword the refusal without the class leaving this module. */
export function isResponseTooLarge(err: unknown): err is Error {
  return err instanceof ResponseTooLargeError
}

/** A read that failed decided nothing; a refused read is the answer itself. */
export function rethrowRefusal(err: unknown): null {
  if (isResponseTooLarge(err)) throw err
  return null
}
