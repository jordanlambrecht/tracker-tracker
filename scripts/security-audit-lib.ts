// scripts/security-audit-lib.ts
//
// Recognizers shared with scripts/security-audit.ts. Nothing here touches the
// filesystem or the process, so a test can import it; the audit script keeps
// its CLI entry and still runs every check on load.
//
// Functions: fetchWindowEnd, catchBodyLines, swallowsError, hasInjectionGuard, logsCredential,
//            gatesAuthResult, stripEncryptAssignment

export const FETCH_RE = /\bfetch\s*\(/

// A file with an unbalanced parenthesis must not drag the window to the end of
// the file, so the balancer gives up after this many lines.
export const FETCH_WINDOW_MAX_LINES = 60

// Index of the last line belonging to the fetch() argument list that starts on
// lines[startIndex]. Balancing parentheses keeps a long options object inside
// the window.
export function fetchWindowEnd(lines: string[], startIndex: number): number {
  const fetchAt = lines[startIndex].search(FETCH_RE)
  let depth = 0
  let opened = false
  let windowEnd = startIndex

  for (let j = startIndex; j < Math.min(startIndex + FETCH_WINDOW_MAX_LINES, lines.length); j++) {
    const from = j === startIndex ? fetchAt : 0
    for (let k = from; k < lines[j].length; k++) {
      const ch = lines[j][k]
      if (ch === "(") {
        depth++
        opened = true
      } else if (ch === ")") {
        depth--
      }
    }
    windowEnd = j
    if (opened && depth <= 0) break
  }

  return windowEnd
}

export const CATCH_RE = /}\s*catch\s*(?:\([^)]*\))?\s*\{/

// Inside the body, a log, a rethrow, an error response or any return counts as
// handling the error.
const RECOVERY_RE =
  /console\.error|console\.warn|log\.error|log\.warn|\bthrow\b|setPollError|setError|return\s+null|return\s+\[\]|return\s+0|return\s+false|NextResponse\.json|Response\.json|return\s+new\s+Response|return\s+NextResponse|status:\s*[45]\d\d|\.push\s*\(|\breturn\b|\berror\b.*message/

// A file with an unbalanced brace must not drag the body to the end of the
// file, so the balancer gives up after this many lines.
export const CATCH_BODY_MAX_LINES = 60

// The catch block that opens on lines[startIndex], one entry per line, from
// after its "{" to before the matching "}". Code after the block, such as an
// unrelated return, is not part of it. Braces in strings, comments and regex
// literals still count, so the line cap is the backstop.
export function catchBodyLines(lines: string[], startIndex: number): string[] {
  const match = CATCH_RE.exec(lines[startIndex])
  if (!match) return []
  const body: string[] = []
  let depth = 1

  for (let j = startIndex; j < Math.min(startIndex + CATCH_BODY_MAX_LINES, lines.length); j++) {
    const from = j === startIndex ? match.index + match[0].length : 0
    let k = from
    for (; k < lines[j].length; k++) {
      const ch = lines[j][k]
      if (ch === "{") depth++
      else if (ch === "}") depth--
      if (depth === 0) break
    }
    body.push(lines[j].slice(from, k))
    if (depth === 0) break
  }

  return body
}

export function swallowsError(lines: string[], startIndex: number): boolean {
  return !catchBodyLines(lines, startIndex).some((line) => RECOVERY_RE.test(line))
}

// Evidence that a file validates cookie values before interpolation. Each
// pattern matches a character class written out in code, never a guard's
// name. A blocklist class holds ";", which splits a cookie, and a CR, LF or
// NUL escape. CR and LF split a header. An allowlist class is narrow enough
// that nothing in it can break a header.
const INJECTION_GUARD_PATTERNS = [
  /\[[^\]]*;[^\]]*(?:\\r|\\n|\\x00)[^\]]*\]/, // blocklist, semicolon first
  /\[[^\]]*(?:\\r|\\n|\\x00)[^\]]*;[^\]]*\]/, // blocklist, control char first
  /\[\^a-fA-F0-9\]/, // hex-only allowlist
  /\[\^a-f0-9\]/i, // hex-only allowlist variant
  /\[\^\\w\]/, // word-char-only allowlist
]

export function hasInjectionGuard(content: string): boolean {
  // Comment lines are dropped first: a class quoted in prose describes a guard
  // rather than being one, and the whole-file test would otherwise accept it.
  const code = content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*")
    })
    .join("\n")

  return INJECTION_GUARD_PATTERNS.some((re) => re.test(code))
}

// Variable names that hold credentials in adapter code
const CREDENTIAL_VARS = [
  "apiToken",
  "creds\\.uid",
  "creds\\.pass",
  "creds\\.cookies",
  "cookies",
  "trimmedToken",
  "trimmedPass",
  "trimmedUid",
]

// Adapters log through pino, and console calls are a lint error under
// src/lib/tracker-platforms. Both call shapes are matched.
const CRED_IN_LOG_RE = new RegExp(
  `\\b(?:console\\.(?:log|warn|error)|log\\.(?:debug|info|warn|error))\\s*\\([^)]*\\b(?:${CREDENTIAL_VARS.join("|")})\\b`
)

export function logsCredential(line: string): boolean {
  return CRED_IN_LOG_RE.test(line)
}

// Routes that may check readSession() for null alone. Logout signs out a stale
// session too, so it refuses only a request that sent no usable cookie.
const READ_SESSION_NULL_GATE_ROUTES = new Set(["api/auth/logout"])

const READ_SESSION_RE = /\breadSession\s*\(/
const INSTANCEOF_GATE_RE = /instanceof\s+(?:Next)?Response/
const NULL_GATE_RE = /!\s*session\b|session\s*===?\s*null/
const VALID_STATUS_GATE_RE = /\.status\s*(?:===|!==)\s*["']valid["']/

// authenticate() returns NextResponse | { encryptionKey }, so instanceof checks
// it, and getSession() returns { encryptionKey } | null, so !session does.
// readSession() can also return { status: "stale" }, which is truthy, so a null
// check lets a session from before a password change or lockdown through.
// Outside READ_SESSION_NULL_GATE_ROUTES it needs a status === "valid" check.
export function gatesAuthResult(routePath: string, handlerBody: string): boolean {
  // A commented-out check is not a check
  const code = handlerBody
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith("//") && !trimmed.startsWith("*")
    })
    .join("\n")

  if (READ_SESSION_RE.test(code) && !READ_SESSION_NULL_GATE_ROUTES.has(routePath)) {
    return VALID_STATUS_GATE_RE.test(code)
  }
  return INSTANCEOF_GATE_RE.test(code) || NULL_GATE_RE.test(code)
}

// `const x = encrypt(JSON.stringify(...))` and `updates.x = encrypt(JSON.stringify(...))`
// serialize a value for storage, so check 6 reads the line without that prefix. A property
// line such as `x: encrypt(JSON.stringify(...))` keeps it, since it can sit inside a
// multi-line NextResponse.json.
const ENCRYPT_ASSIGNMENT_RE =
  /^\s*(?:(?:const|let)\s+\w+|updates\.\w+)\s*=\s*encrypt\(\s*JSON\.stringify\(/

export function stripEncryptAssignment(line: string): string {
  return line.replace(ENCRYPT_ASSIGNMENT_RE, "")
}
