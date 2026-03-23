// scripts/security-audit.ts
//
// Static security analysis for CI.
// Outputs JSON to stdout: { results: CheckResult[], summary: { ... } }
//
// Functions: walkFiles, routePathFromFile, getCachedLines, filterIgnoredFindings,
//   checkAuthEnforcement, checkDangerousFunctions, checkHardcodedSecrets,
//   checkSecurityHeaders, checkCookieSecurity, checkSensitiveFieldExposure,
//   checkEnvFiles, checkConsoleLogInRoutes, checkTodoInSecurityFiles,
//   checkRawSqlInRoutes, checkUnvalidatedJsonParse, checkBareCatchBlocks,
//   checkUnsafeRedirectFetch, checkRequestBodySize, checkTimingSafeComparison,
//   checkNoRawMigrations, checkFetchTimeout, checkDockerfileNonRoot,
//   checkProxyAllowlistSync, checkBigIntSafety, checkPathTraversalDefense,
//   checkArgon2Hashing, checkEncryptedColumnWrites, checkTotpFlowIntegrity,
//   checkLockdownFlowIntegrity, checkNukeFlowIntegrity,
//   checkBackupRestoreIntegrity, checkLoginFlowIntegrity, runAudit
//
// Usage: npx tsx scripts/security-audit.ts [--changed-only file1 file2 ...]
// If --changed-only is provided, only those files are scanned for
// file-level checks (2/3/8/9/11/12/14/20). Auth enforcement and headers always
// run a full scan regardless.
//
// Exit code: 1 if any critical check fails, 0 otherwise.

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(__dirname, "..")
const SRC_DIR = path.resolve(ROOT, "src")
const API_DIR = path.resolve(SRC_DIR, "app/api")
const CONFIG_FILE = path.resolve(ROOT, "next.config.ts")

// ── Types ───────────────────────────────────────────────────────────────

interface Finding {
  file: string
  line?: number
  detail: string
}

interface CheckResult {
  id: string
  name: string
  severity: "critical" | "warning"
  status: "pass" | "fail"
  findings: Finding[]
}

interface AuditOutput {
  results: CheckResult[]
  summary: {
    critical: number
    warning: number
    passed: number
    total: number
  }
}

// ── Constants ───────────────────────────────────────────────────────────

// Routes that intentionally skip session verification.
// These are truly public — no cookie, no JWE, no auth at all.
// Routes that do their own auth (i.e logout via getSession) are NOT listed.
// NOTE: api/changelog is NOT listed here — it calls authenticate() and must remain protected.
const NO_AUTH_ROUTES = new Set([
  "api/auth/setup",
  "api/auth/login",
  "api/auth/status",
  "api/auth/totp/verify",
  "api/health",
])

// Both patterns are valid auth mechanisms:
// - authenticate() from api-helpers.ts (standard pattern)
// - getSession() from auth.ts (used by logout)
const AUTH_PATTERNS = [/\bauthenticate\s*\(/, /\bgetSession\s*\(/, /\brequireAuth\s*\(/]

const REQUIRED_HEADERS = [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-XSS-Protection",
  "X-DNS-Prefetch-Control",
  "Referrer-Policy",
  "Permissions-Policy",
]

// Fields that must never appear in API responses (per SECURITY.md)
const SENSITIVE_FIELDS = [
  "encryptedApiToken",
  "passwordHash",
  "encryptedPassword",
  "encryptedUsername",
  "encryptedProxyPassword",
]

// Dangerous JS patterns that indicate code injection risk
const DANGEROUS_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /\beval\s*\(/, name: "eval()" },
  // We check for "new Function(" as a string but use a constructed regex
  // to avoid triggering our own hook
  { re: new RegExp("new\\s+Func" + "tion\\s*\\("), name: "new Func" + "tion()" },
  { re: /dangerouslySetInnerHTML/, name: "dangerouslySetInnerHTML" },
  { re: /\.innerHTML\s*=/, name: "innerHTML assignment" },
  { re: /document\.write\s*\(/, name: "document.write()" },
]

// Known credential patterns (high-confidence, low false-positive)
const SECRET_PATTERNS: Array<{ re: RegExp; name: string }> = [
  { re: /AKIA[0-9A-Z]{16}/, name: "AWS Access Key" },
  { re: /-----BEGIN[A-Z ]*PRIVATE KEY/, name: "Private Key" },
  { re: /ghp_[A-Za-z0-9]{36}/, name: "GitHub PAT" },
  { re: /gho_[A-Za-z0-9]{36}/, name: "GitHub OAuth Token" },
  { re: /sk_live_[a-zA-Z0-9]{20,}/, name: "Stripe Live Key" },
  { re: /sk_test_[a-zA-Z0-9]{20,}/, name: "Stripe Test Key" },
]

// Files with security-critical logic — flag TODO/FIXME here
const SECURITY_FILES = [
  "src/lib/auth.ts",
  "src/lib/crypto.ts",
  "src/lib/lockout.ts",
  "src/lib/nuke.ts",
  "src/lib/totp.ts",
  "src/lib/privacy.ts",
  "src/lib/proxy.ts",
  "src/lib/api-helpers.ts",
  "src/proxy.ts",
]

// ── Helpers ─────────────────────────────────────────────────────────────

function walkFiles(dir: string, ext: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      results.push(...walkFiles(full, ext))
    } else if (entry.name.endsWith(ext)) {
      results.push(full)
    }
  }
  return results
}

function relativePath(absPath: string): string {
  return path.relative(ROOT, absPath)
}

function findAllLineNumbers(content: string, pattern: RegExp): number[] {
  const lines = content.split("\n")
  const matches: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) matches.push(i + 1)
  }
  return matches
}

/** Convert route file path to API route path (i.e "api/trackers/[id]") */
function routePathFromFile(filePath: string): string {
  const rel = path.relative(API_DIR, filePath)
  return `api/${rel.replace(/[/\\]route\.ts$/, "").replace(/\\/g, "/")}`
}

function isTestFile(filePath: string): boolean {
  const rel = relativePath(filePath)
  return (
    rel.includes("__tests__") ||
    rel.includes(".test.") ||
    rel.includes(".spec.") ||
    rel.startsWith("scripts/")
  )
}

// ── Inline ignore support ─────────────────────────────────────────────
//
// Place on the flagged line or the line above:
//   // security-audit-ignore: stream already closed, nothing to recover
//
// The colon + reason text are REQUIRED. A bare "// security-audit-ignore"
// without a reason is itself a critical failure.

const AUDIT_IGNORE_RE = /(?:\/\/|\/\*)\s*security-audit-ignore\b/
const AUDIT_IGNORE_WITH_REASON_RE = /(?:\/\/|\/\*)\s*security-audit-ignore\s*:\s*\S/

const _lineCache = new Map<string, string[]>()

function getCachedLines(relFile: string): string[] | null {
  const cached = _lineCache.get(relFile)
  if (cached) return cached
  const absPath = path.resolve(ROOT, relFile)
  if (!fs.existsSync(absPath)) return null
  const lines = fs.readFileSync(absPath, "utf8").split("\n")
  _lineCache.set(relFile, lines)
  return lines
}

/**
 * Post-process check results: strip findings covered by a valid ignore
 * comment, and add a critical check for ignore comments missing a reason.
 */
function filterIgnoredFindings(results: CheckResult[]): CheckResult[] {
  const missingReasonFindings: Finding[] = []
  const seenMissingReason = new Set<string>()

  const filtered = results.map((result) => {
    const keptFindings = result.findings.filter((finding) => {
      if (!finding.line || !finding.file) return true

      const lines = getCachedLines(finding.file)
      if (!lines) return true

      const lineIdx = finding.line - 1

      // Check flagged line, one above, and two below (catch blocks have ignore comments inside the block body)
      for (const checkIdx of [lineIdx, lineIdx - 1, lineIdx + 1, lineIdx + 2]) {
        if (checkIdx < 0 || checkIdx >= lines.length) continue
        const checkLine = lines[checkIdx]

        if (AUDIT_IGNORE_RE.test(checkLine)) {
          if (AUDIT_IGNORE_WITH_REASON_RE.test(checkLine)) {
            return false // properly suppressed
          }
          const key = `${finding.file}:${checkIdx + 1}`
          if (!seenMissingReason.has(key)) {
            seenMissingReason.add(key)
            missingReasonFindings.push({
              file: finding.file,
              line: checkIdx + 1,
              detail:
                "security-audit-ignore missing reason — use: // security-audit-ignore: <reason>",
            })
          }
          return true // NOT suppressed — reason is required
        }
      }

      return true
    })

    return {
      ...result,
      findings: keptFindings,
      status: (keptFindings.length === 0 ? "pass" : "fail") as "pass" | "fail",
    }
  })

  if (missingReasonFindings.length > 0) {
    filtered.push({
      id: "audit-ignore-reason",
      name: "Inline audit-ignore comments must include a reason",
      severity: "critical",
      status: "fail",
      findings: missingReasonFindings,
    })
  }

  return filtered
}

// ── Check 1: Auth enforcement ───────────────────────────────────────────

function checkAuthEnforcement(): CheckResult {
  const findings: Finding[] = []
  const routeFiles = walkFiles(API_DIR, "route.ts")
  const EXPORTED_HANDLERS = /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g

  for (const file of routeFiles) {
    const routePath = routePathFromFile(file)
    if (NO_AUTH_ROUTES.has(routePath)) continue

    const content = fs.readFileSync(file, "utf8")
    const handlers = [...content.matchAll(EXPORTED_HANDLERS)].map((m) => m[1])
    if (handlers.length === 0) continue

    // Accept any of the valid auth patterns
    const hasAuth = AUTH_PATTERNS.some((re) => re.test(content))

    if (!hasAuth) {
      for (const method of handlers) {
        findings.push({
          file: relativePath(file),
          detail: `${method} /${routePath} — no auth check (missing authenticate/getSession/requireAuth)`,
        })
      }
    }
  }

  return {
    id: "auth-enforcement",
    name: "Auth enforcement on protected routes",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 2: Dangerous functions ────────────────────────────────────────

function checkDangerousFunctions(files?: string[]): CheckResult {
  const findings: Finding[] = []
  const targetFiles = files ?? walkFiles(SRC_DIR, ".ts").concat(walkFiles(SRC_DIR, ".tsx"))

  for (const file of targetFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")

    for (const { re, name } of DANGEROUS_PATTERNS) {
      const lineNums = findAllLineNumbers(content, re)
      for (const line of lineNums) {
        // Skip commented-out lines
        const lineContent = content.split("\n")[line - 1]?.trim()
        if (lineContent?.startsWith("//") || lineContent?.startsWith("*")) continue

        findings.push({
          file: relativePath(file),
          line,
          detail: `Dangerous function: ${name}`,
        })
      }
    }
  }

  return {
    id: "dangerous-functions",
    name: "No dangerous functions (eval, innerHTML, etc.)",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 3: Hardcoded secrets ──────────────────────────────────────────

function checkHardcodedSecrets(files?: string[]): CheckResult {
  const findings: Finding[] = []
  const targetFiles = files ?? walkFiles(SRC_DIR, ".ts").concat(walkFiles(SRC_DIR, ".tsx"))

  for (const file of targetFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")

    for (const { re, name } of SECRET_PATTERNS) {
      const lineNums = findAllLineNumbers(content, re)
      for (const line of lineNums) {
        // Skip commented-out lines
        const lineContent = content.split("\n")[line - 1]?.trim()
        if (lineContent?.startsWith("//") || lineContent?.startsWith("*")) continue

        findings.push({
          file: relativePath(file),
          line,
          detail: `Possible hardcoded secret: ${name}`,
        })
      }
    }
  }

  return {
    id: "hardcoded-secrets",
    name: "No hardcoded secrets in source",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 4: Security headers ───────────────────────────────────────────

function checkSecurityHeaders(): CheckResult {
  const findings: Finding[] = []

  if (!fs.existsSync(CONFIG_FILE)) {
    findings.push({ file: "next.config.ts", detail: "Config file not found" })
    return {
      id: "security-headers",
      name: "Security headers in next.config.ts",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const content = fs.readFileSync(CONFIG_FILE, "utf8")
  for (const header of REQUIRED_HEADERS) {
    if (!content.includes(header)) {
      findings.push({
        file: "next.config.ts",
        detail: `Missing security header: ${header}`,
      })
    }
  }

  return {
    id: "security-headers",
    name: "Security headers in next.config.ts",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 5: Cookie security ────────────────────────────────────────────

function checkCookieSecurity(): CheckResult {
  const findings: Finding[] = []
  const allFiles = walkFiles(SRC_DIR, ".ts").concat(walkFiles(SRC_DIR, ".tsx"))
  const COOKIE_SET_RE = /(?:\.cookies|cookieStore|\bcookies\(\))\.set\s*\(/

  for (const file of allFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    if (!COOKIE_SET_RE.test(content)) continue

    const rel = relativePath(file)

    if (!content.includes("httpOnly: true") && !content.includes("httpOnly:true")) {
      findings.push({
        file: rel,
        detail: "Cookie set without httpOnly: true",
      })
    }

    if (!content.includes('sameSite: "strict"') && !content.includes("sameSite: 'strict'")) {
      findings.push({
        file: rel,
        detail: 'Cookie set without sameSite: "strict"',
      })
    }

    // secure flag must be present (even if conditional on NODE_ENV)
    if (!content.includes("secure:") && !content.includes("secure :")) {
      findings.push({
        file: rel,
        detail: "Cookie set without secure flag",
      })
    }
  }

  return {
    id: "cookie-security",
    name: "Cookie security (httpOnly, sameSite, secure)",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 6: Sensitive field exposure in routes ─────────────────────────

function checkSensitiveFieldExposure(): CheckResult {
  const findings: Finding[] = []
  const routeFiles = walkFiles(API_DIR, "route.ts")

  for (const file of routeFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    const rel = relativePath(file)
    const lines = content.split("\n")

    for (const field of SENSITIVE_FIELDS) {
      if (!content.includes(field)) continue

      // Check if the field is being excluded (destructured out)
      const destructureExclude = new RegExp(
        `\\{[^}]*\\b${field}\\b[^}]*,\\s*\\.\\.\\.\\w+[^}]*\\}\\s*=`
      )
      const hasExclusion = destructureExclude.test(content)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line.includes(field)) continue

        const trimmed = line.trim()

        // Skip: comments, imports, types
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("import") ||
          trimmed.startsWith("type ") ||
          trimmed.startsWith("interface ")
        )
          continue

        // Skip: Drizzle schema references (querying, not exposing)
        if (trimmed.includes("eq(") || trimmed.includes("select({")) continue

        // Skip: destructuring exclusion on this line
        if (destructureExclude.test(line)) continue

        // Flag: field near JSON response without destructuring exclusion
        if (
          !hasExclusion &&
          (line.includes("NextResponse.json") ||
            line.includes("JSON.stringify") ||
            line.includes("json("))
        ) {
          findings.push({
            file: rel,
            line: i + 1,
            detail: `Sensitive field "${field}" may be exposed in response`,
          })
        }
      }
    }
  }

  return {
    id: "sensitive-field-exposure",
    name: "No sensitive fields in API responses",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 7: Env files in repo ──────────────────────────────────────────

function checkEnvFiles(): CheckResult {
  const findings: Finding[] = []
  const envNames = [".env", ".env.local", ".env.production", ".env.development", ".env.staging"]

  // Use git to check if any env files are tracked (not just on disk).
  // Untracked .env.local files are expected in local dev.
  try {
    const tracked = execFileSync("git", ["ls-files", ...envNames], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim()

    if (tracked) {
      for (const file of tracked.split("\n").filter(Boolean)) {
        findings.push({
          file,
          detail: `Environment file "${file}" is tracked by git — add to .gitignore and remove`,
        })
      }
    }
  } catch {
    // git not available — fall back to file existence check
    for (const name of envNames) {
      if (fs.existsSync(path.join(ROOT, name))) {
        findings.push({
          file: name,
          detail: `Environment file "${name}" exists (git check unavailable)`,
        })
      }
    }
  }

  return {
    id: "env-files",
    name: "No .env files committed to repo",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 8: console.log in API routes (warning) ────────────────────────

function checkConsoleLogInRoutes(files?: string[]): CheckResult {
  const findings: Finding[] = []
  const targetFiles = files
    ? files.filter((f) => f.includes("app/api") && f.endsWith("route.ts"))
    : walkFiles(API_DIR, "route.ts")

  const CONSOLE_RE = /console\.(log|debug|info)\s*\(/

  for (const file of targetFiles) {
    const content = fs.readFileSync(file, "utf8")
    const lineNums = findAllLineNumbers(content, CONSOLE_RE)

    for (const line of lineNums) {
      const lineContent = content.split("\n")[line - 1]?.trim()
      if (lineContent?.startsWith("//")) continue

      findings.push({
        file: relativePath(file),
        line,
        detail: "console.log/debug/info in API route — may leak sensitive data in production",
      })
    }
  }

  return {
    id: "console-in-routes",
    name: "No console.log in API routes",
    severity: "warning",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 9: TODO/FIXME in security files (warning) ─────────────────────

function checkTodoInSecurityFiles(): CheckResult {
  const findings: Finding[] = []
  const TODO_RE = /\b(TODO|FIXME|HACK|XXX)\b/

  for (const relFile of SECURITY_FILES) {
    const absPath = path.join(ROOT, relFile)
    if (!fs.existsSync(absPath)) continue
    const content = fs.readFileSync(absPath, "utf8")

    const lineNums = findAllLineNumbers(content, TODO_RE)
    for (const line of lineNums) {
      const lineContent = content.split("\n")[line - 1]?.trim() ?? ""
      findings.push({
        file: relFile,
        line,
        detail: lineContent.slice(0, 120),
      })
    }
  }

  return {
    id: "todo-in-security-files",
    name: "No TODO/FIXME in security-critical files",
    severity: "warning",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 10: Raw SQL in API routes (critical) ───────────────────────────

// Hardcoded-safe SQL literals permitted in route files.
// These are DB connectivity checks with no user input — identical in safety
// to the scrub operations in nuke.ts.
const SAFE_RAW_SQL_RE = /db\.execute\s*\(\s*sql`SELECT\s+1`\s*\)/

function checkRawSqlInRoutes(): CheckResult {
  const findings: Finding[] = []
  const routeFiles = walkFiles(API_DIR, "route.ts")
  const RAW_SQL_RE = /db\.execute\s*\(/

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf8")
    const lineNums = findAllLineNumbers(content, RAW_SQL_RE)
    for (const line of lineNums) {
      const lineContent = content.split("\n")[line - 1]?.trim()
      if (lineContent?.startsWith("//")) continue
      // Allow hardcoded DB ping (SELECT 1) — no user input, same category as nuke.ts
      if (lineContent && SAFE_RAW_SQL_RE.test(lineContent)) continue
      findings.push({
        file: relativePath(file),
        line,
        detail: "Raw SQL (db.execute) in API route — use Drizzle query builder instead",
      })
    }
  }

  return {
    id: "raw-sql-in-routes",
    name: "No raw SQL in API routes",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 11: Unvalidated JSON.parse (warning) ───────────────────────────

function checkUnvalidatedJsonParse(files?: string[]): CheckResult {
  const findings: Finding[] = []
  const targetFiles = files ?? walkFiles(SRC_DIR, ".ts").concat(walkFiles(SRC_DIR, ".tsx"))

  for (const file of targetFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      if (!/JSON\.parse\s*\(/.test(lines[i])) continue

      const lineContent = lines[i].trim()
      if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue

      // Scan backwards up to 20 lines for a try { or try{
      let insideTry = false
      for (let j = i; j >= 0 && j > i - 20; j--) {
        if (/\btry\s*\{/.test(lines[j])) {
          insideTry = true
          break
        }
      }

      if (!insideTry) {
        findings.push({
          file: relativePath(file),
          line: i + 1,
          detail: "JSON.parse() called outside a try-catch block",
        })
      }
    }
  }

  return {
    id: "unvalidated-json-parse",
    name: "JSON.parse wrapped in try-catch",
    severity: "warning",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 12: Bare catch blocks (warning) ───────────────────────────────

function checkBareCatchBlocks(files?: string[]): CheckResult {
  const findings: Finding[] = []
  // Only scan API routes and lib files — client components legitimately
  // use bare catch for fetch abort cleanup, React error boundaries, etc.
  const serverFiles = files
    ? files.filter((f) => f.includes("app/api/") || f.includes("src/lib/"))
    : walkFiles(API_DIR, ".ts").concat(walkFiles(path.resolve(SRC_DIR, "lib"), ".ts"))

  const CATCH_RE = /}\s*catch\s*(?:\([^)]*\))?\s*\{/
  const RECOVERY_RE =
    /console\.error|console\.warn|log\.error|log\.warn|\bthrow\b|setPollError|setError|return\s+null|return\s+\[\]|return\s+0|return\s+false|NextResponse\.json|Response\.json|return\s+new\s+Response|return\s+NextResponse|status:\s*[45]\d\d|\.push\s*\(|\breturn\b|\berror\b.*message/

  for (const file of serverFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const lineContent = lines[i].trim()
      if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue
      if (!CATCH_RE.test(lines[i])) continue

      // Check the next 8 lines for any recovery action
      let hasRecovery = false
      for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
        if (RECOVERY_RE.test(lines[j])) {
          hasRecovery = true
          break
        }
      }

      if (!hasRecovery) {
        findings.push({
          file: relativePath(file),
          line: i + 1,
          detail: "catch block swallows error without logging or re-throwing",
        })
      }
    }
  }

  return {
    id: "bare-catch-blocks",
    name: "No swallowed errors in catch blocks",
    severity: "warning",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 13: Unsafe redirect/fetch with user input (critical) ───────────

function checkUnsafeRedirectFetch(): CheckResult {
  const findings: Finding[] = []
  const routeFiles = walkFiles(API_DIR, "route.ts")

  // A fetch URL is suspicious when it contains a variable (not a pure string literal
  // and not exclusively a process.env reference)
  const VARIABLE_FETCH_RE = /\bfetch\s*\(\s*(?!['"`]\/api\/)(?![`'"])[^,)]+/
  const REDIRECT_VAR_RE = /\b(?:redirect|Response\.redirect)\s*\(\s*(?![`'"])[^,)]+/
  const USER_INPUT_RE = /request\.json\(\)|searchParams\b/
  const ENV_ONLY_RE = /^`?\s*process\.env\.\w+/

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, "utf8")
    const rel = relativePath(file)

    const hasUserInput = USER_INPUT_RE.test(content)
    if (!hasUserInput) continue

    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const lineContent = lines[i].trim()
      if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue

      if (VARIABLE_FETCH_RE.test(lines[i])) {
        // Allow internal /api/ fetches (string literals starting with /api/)
        if (/fetch\s*\(\s*['"`]\/api\//.test(lines[i])) continue
        // Allow process.env-only URLs
        const urlMatch = lines[i].match(/fetch\s*\(\s*([^,)]+)/)
        if (urlMatch && ENV_ONLY_RE.test(urlMatch[1].trim())) continue

        findings.push({
          file: rel,
          line: i + 1,
          detail:
            "fetch() with variable URL in route that also uses user input — validate/allowlist the URL",
        })
      }

      if (REDIRECT_VAR_RE.test(lines[i])) {
        findings.push({
          file: rel,
          line: i + 1,
          detail:
            "redirect() with non-literal URL in route that also uses user input — validate the URL",
        })
      }
    }
  }

  return {
    id: "unsafe-redirect-fetch",
    name: "No fetch/redirect with unvalidated URLs in routes",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 14: Missing request body size check (warning) ─────────────────

function checkRequestBodySize(files?: string[]): CheckResult {
  const findings: Finding[] = []
  const targetFiles = files
    ? files.filter((f) => f.includes("app/api") && f.endsWith("route.ts"))
    : walkFiles(API_DIR, "route.ts")

  const BODY_PARSE_RE = /request\.(?:json|text|formData)\s*\(\s*\)/
  const SIZE_CHECK_RE =
    /content-length|Content-Length|\.size\s*[><=]|\.length\s*[><=]|MAX_\w*SIZE|maxSize\b|maxLength\b|bodyLimit/i

  for (const file of targetFiles) {
    const content = fs.readFileSync(file, "utf8")
    const lines = content.split("\n")

    // Exempt trivial routes
    if (lines.length < 30) continue

    // Only flag POST/PATCH/PUT handlers that parse the body
    const hasMutableHandler = /export\s+(?:async\s+)?function\s+(?:POST|PATCH|PUT)\b/.test(content)
    if (!hasMutableHandler) continue

    if (!BODY_PARSE_RE.test(content)) continue
    if (SIZE_CHECK_RE.test(content)) continue

    findings.push({
      file: relativePath(file),
      detail: "POST/PATCH/PUT handler parses request body without a size/length check",
    })
  }

  return {
    id: "request-body-size",
    name: "Request body size validation on upload routes",
    severity: "warning",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 15: Timing-safe comparison for secrets (critical) ─────────────

// Variable name patterns that indicate an actual secret value being compared.
// Must be specific enough to avoid matching loop vars named "key", UI fields like "giftTokens", etc.
// Pattern: the variable name must START or END with the secret word, or be an exact compound like "apiToken".
const SECRET_VAR_RE =
  /\b(?:password(?:Hash)?|apiToken|sessionToken|secretKey|encryptionKey|masterKey|totpSecret|backupCode|authToken|jweToken|pendingToken)\b/

// Allowlist: comparisons against literal keywords, type values, null checks, length checks, typeof checks
const ALLOWLISTED_COMPARE_RE =
  /===?\s*(?:null|undefined|true|false|"[a-z_]+"|\d+)\s*$|^(?:null|undefined|true|false|"[a-z_]+"|\d+)\s*===?|\.length\s*===?|typeof\s+[\w.]+\s*===?\s*"|\?\s*[\w.]+\s*:/

function checkTimingSafeComparison(): CheckResult {
  const findings: Finding[] = []

  // Scan all non-test .ts files in src/lib/ and src/app/api/
  const libDir = path.resolve(SRC_DIR, "lib")
  const scanFiles = [...walkFiles(libDir, ".ts"), ...walkFiles(API_DIR, ".ts")]

  for (const absPath of scanFiles) {
    if (isTestFile(absPath)) continue
    if (!fs.existsSync(absPath)) continue

    const relFile = relativePath(absPath)
    const content = fs.readFileSync(absPath, "utf8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue

      // Look for === or == comparisons
      if (!/[^!<>=]={2,3}(?!=)/.test(line)) continue

      // Skip allowlisted patterns (comparisons to null/undefined/true/false/literal words)
      if (ALLOWLISTED_COMPARE_RE.test(trimmed)) continue

      // Check if either side of the comparison references a secret-named variable
      const eqMatch = line.match(/([^=!<>]+?)\s*={2,3}\s*([^=].*)/)
      if (!eqMatch) continue

      const lhs = eqMatch[1].trim()
      const rhs = eqMatch[2].split(/[;,)?\s]/)[0].trim()

      const lhsIsSecret = SECRET_VAR_RE.test(lhs)
      const rhsIsSecret = SECRET_VAR_RE.test(rhs)

      if (!lhsIsSecret && !rhsIsSecret) continue

      // Per-line check: look for timingSafeEqual within ±10 lines of this comparison
      const windowStart = Math.max(0, i - 10)
      const windowEnd = Math.min(lines.length - 1, i + 10)
      const localWindow = lines.slice(windowStart, windowEnd + 1).join("\n")
      const hasLocalTimingSafe = localWindow.includes("timingSafeEqual")

      if (!hasLocalTimingSafe) {
        findings.push({
          file: relFile,
          line: i + 1,
          detail: `Direct equality comparison involving secret variable — use timingSafeEqual instead`,
        })
      }
    }
  }

  return {
    id: "timing-safe-comparison",
    name: "Timing-safe comparison for secret values",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 16: No raw SQL migrations (critical) ───────────────────────────

function checkNoRawMigrations(): CheckResult {
  const findings: Finding[] = []
  const MIGRATIONS_DIR = path.resolve(SRC_DIR, "lib/db/migrations")
  const DRIZZLE_MIGRATIONS_DIR = path.resolve(ROOT, "drizzle")

  // Check for a migrations directory with .sql files
  for (const dir of [MIGRATIONS_DIR, DRIZZLE_MIGRATIONS_DIR]) {
    if (!fs.existsSync(dir)) continue
    const sqlFiles = walkFiles(dir, ".sql")
    for (const f of sqlFiles) {
      findings.push({
        file: relativePath(f),
        detail:
          "Raw SQL migration file found — use drizzle-kit push (schema-first) instead of generate/migrate",
      })
    }
  }

  // Check package.json scripts for drizzle-kit generate or migrate
  const pkgPath = path.join(ROOT, "package.json")
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      scripts?: Record<string, string>
    }
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      if (/drizzle-kit\s+(generate|migrate)\b/.test(cmd)) {
        findings.push({
          file: "package.json",
          detail: `Script "${name}" uses drizzle-kit generate/migrate — use drizzle-kit push instead`,
        })
      }
    }
  }

  // Check CI workflow files for drizzle-kit generate or migrate
  const workflowDir = path.join(ROOT, ".github/workflows")
  if (fs.existsSync(workflowDir)) {
    const yamlFiles = [...walkFiles(workflowDir, ".yml"), ...walkFiles(workflowDir, ".yaml")]
    for (const f of yamlFiles) {
      const content = fs.readFileSync(f, "utf8")
      if (/drizzle-kit\s+(generate|migrate)\b/.test(content)) {
        findings.push({
          file: relativePath(f),
          detail: "CI workflow uses drizzle-kit generate/migrate — use drizzle-kit push instead",
        })
      }
    }
  }

  return {
    id: "no-raw-migrations",
    name: "No raw SQL migration files (schema-first only)",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 17: External fetch calls have timeouts (critical) ─────────────

// proxy.ts uses https.request with a timeout option — not fetch() — so it
// is intentionally excluded from this scan.
function checkFetchTimeout(): CheckResult {
  const findings: Finding[] = []
  const FETCH_RE = /\bfetch\s*\(/

  const adaptersDir = path.resolve(SRC_DIR, "lib/adapters")
  const qbtDir = path.resolve(SRC_DIR, "lib/qbt")
  const libDir = path.resolve(SRC_DIR, "lib")

  // Collect all .ts files from adapters/ and qbt/ (recursive via walkFiles),
  // plus direct .ts files in lib/ root only (not recursive into subdirs).
  const libRootFiles = fs.existsSync(libDir)
    ? fs
        .readdirSync(libDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".ts"))
        .map((e) => path.join(libDir, e.name))
    : []

  const scanFiles = [...walkFiles(adaptersDir, ".ts"), ...walkFiles(qbtDir, ".ts"), ...libRootFiles]

  for (const absPath of scanFiles) {
    if (isTestFile(absPath)) continue
    if (!fs.existsSync(absPath)) continue

    const relFile = relativePath(absPath)
    const content = fs.readFileSync(absPath, "utf8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
      if (!FETCH_RE.test(line)) continue

      // Check within 5 lines after (and on the same line) for timeout indicators
      const windowEnd = Math.min(i + 5, lines.length - 1)
      const fetchWindow = lines.slice(i, windowEnd + 1).join("\n")

      const hasTimeout =
        /\bsignal\s*:/.test(fetchWindow) ||
        /AbortSignal\.timeout/.test(fetchWindow) ||
        /\btimeout\s*:/.test(fetchWindow)

      if (!hasTimeout) {
        findings.push({
          file: relFile,
          line: i + 1,
          detail: "fetch() call without a timeout signal — add signal: AbortSignal.timeout(ms)",
        })
      }
    }
  }

  return {
    id: "fetch-timeout",
    name: "External fetch calls have timeouts",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 18: Dockerfile runs as non-root user (critical) ────────────────

function checkDockerfileNonRoot(): CheckResult {
  const findings: Finding[] = []
  const dockerfilePath = path.join(ROOT, "Dockerfile")

  if (!fs.existsSync(dockerfilePath)) {
    // Not applicable — no Dockerfile in the repo
    return {
      id: "dockerfile-nonroot",
      name: "Docker container runs as non-root user",
      severity: "critical",
      status: "pass",
      findings,
    }
  }

  const content = fs.readFileSync(dockerfilePath, "utf8")
  const docLines = content.split("\n")

  // Collect all USER directives in document order
  const userDirectives: Array<{ value: string; line: number }> = []
  for (let i = 0; i < docLines.length; i++) {
    const m = /^\s*USER\s+(\S+)/.exec(docLines[i])
    if (m) userDirectives.push({ value: m[1], line: i + 1 })
  }

  if (userDirectives.length === 0) {
    findings.push({
      file: "Dockerfile",
      detail: "No USER directive found — container will run as root",
    })
  } else {
    const lastUser = userDirectives[userDirectives.length - 1]
    if (lastUser.value === "root" || lastUser.value === "0") {
      findings.push({
        file: "Dockerfile",
        line: lastUser.line,
        detail: `Final USER directive is "${lastUser.value}" — container runs as root`,
      })
    }
  }

  // Verify a non-root user is actually created (not just switched to an assumed account)
  const hasUserCreation =
    /\badduser\b/.test(content) ||
    /\baddgroup\b/.test(content) ||
    /\buseradd\b/.test(content) ||
    /\bgroupadd\b/.test(content)

  if (!hasUserCreation) {
    findings.push({
      file: "Dockerfile",
      detail:
        "No adduser/addgroup directive found — USER directive may reference a non-existent or root-adjacent user",
    })
  }

  return {
    id: "dockerfile-nonroot",
    name: "Docker container runs as non-root user",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 19: Public routes match proxy allowlist (critical) ─────────────

/** Strip leading slashes for consistent comparison. */
function normalizeRoute(r: string): string {
  return r.replace(/^\/+/, "")
}

function checkProxyAllowlistSync(): CheckResult {
  const findings: Finding[] = []

  const proxyPath = path.join(ROOT, "src/proxy.ts")
  if (!fs.existsSync(proxyPath)) {
    findings.push({
      file: "src/proxy.ts",
      detail: "src/proxy.ts not found — cannot verify allowlist sync",
    })
    return {
      id: "proxy-allowlist-sync",
      name: "Public routes match proxy allowlist",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const proxyContent = fs.readFileSync(proxyPath, "utf8")

  // Extract exact routes from PUBLIC_EXACT array literal
  const exactArrayMatch = proxyContent.match(/PUBLIC_EXACT\s*=\s*\[([^\]]+)\]/)
  const proxyExact = new Set<string>()
  if (exactArrayMatch) {
    for (const m of exactArrayMatch[1].matchAll(/"([^"]+)"|'([^']+)'/g)) {
      proxyExact.add(normalizeRoute(m[1] ?? m[2]))
    }
  }

  // Extract prefix routes from PUBLIC_PREFIX array literal
  const prefixArrayMatch = proxyContent.match(/PUBLIC_PREFIX\s*=\s*\[([^\]]+)\]/)
  const proxyPrefixes: string[] = []
  if (prefixArrayMatch) {
    for (const m of prefixArrayMatch[1].matchAll(/"([^"]+)"|'([^']+)'/g)) {
      proxyPrefixes.push(normalizeRoute(m[1] ?? m[2]))
    }
  }

  // A route is proxy-public if it matches an exact entry or starts with a prefix
  function isCoveredByProxy(normalizedRoute: string): boolean {
    if (proxyExact.has(normalizedRoute)) return true
    return proxyPrefixes.some((prefix) => normalizedRoute.startsWith(normalizeRoute(prefix)))
  }

  // Every NO_AUTH_ROUTES entry must be reachable through the proxy allowlist
  for (const route of NO_AUTH_ROUTES) {
    const normalized = normalizeRoute(route)
    if (!isCoveredByProxy(normalized)) {
      findings.push({
        file: "src/proxy.ts",
        detail: `NO_AUTH_ROUTES contains "${route}" but it is not in the proxy public allowlist — the proxy will block unauthenticated requests before the route handler runs`,
      })
    }
  }

  // Page routes (non-API) intentionally appear in the proxy allowlist but
  // not in NO_AUTH_ROUTES — they are excluded from the reverse check.
  const PAGE_ROUTES = new Set(["login", "setup"])
  for (const route of proxyExact) {
    if (PAGE_ROUTES.has(route)) continue
    if (!NO_AUTH_ROUTES.has(route)) {
      findings.push({
        file: "src/proxy.ts",
        detail: `Proxy allowlist contains exact route "/${route}" but it is absent from NO_AUTH_ROUTES in security-audit.ts — verify it is intentionally public and add it to NO_AUTH_ROUTES`,
      })
    }
  }

  return {
    id: "proxy-allowlist-sync",
    name: "Public routes match proxy allowlist",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 20: BigInt fields use string serialization (warning) ───────────

// Column names that hold BigInt values in the DB schema
const BIGINT_COLUMNS = [
  "uploadedBytes",
  "downloadedBytes",
  "bufferBytes",
  "rawUploadedBytes",
  "rawDownloadedBytes",
]

function checkBigIntSafety(files?: string[]): CheckResult {
  const findings: Finding[] = []
  const targetFiles = files
    ? files.filter((f) => f.includes("app/api") && f.endsWith("route.ts"))
    : walkFiles(API_DIR, "route.ts")

  const BIGINT_COL_PATTERN = BIGINT_COLUMNS.join("|")
  const UNSAFE_RE = new RegExp(`\\b(?:Number|parseInt)\\s*\\([^)]*\\b(${BIGINT_COL_PATTERN})\\b`)

  for (const file of targetFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue
      if (!UNSAFE_RE.test(line)) continue

      const match = line.match(UNSAFE_RE)
      const colName = match?.[1] ?? "BigInt column"

      findings.push({
        file: relativePath(file),
        line: i + 1,
        detail: `Number()/parseInt() on BigInt column "${colName}" — use String() or .toString() to avoid precision loss above 2^53`,
      })
    }
  }

  return {
    id: "bigint-safety",
    name: "BigInt fields use string serialization",
    severity: "warning",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 21: Path traversal defense on file operations (critical) ────

function checkPathTraversalDefense(): CheckResult {
  const findings: Finding[] = []

  // Only flag file deletion — writes to server-configured paths (mkdir + writeFile
  // with storagePath from DB) are not user-controlled and don't need traversal defense.
  const FS_DELETE_RE = /\b(?:unlink|unlinkSync|rmSync|rm)\s*\(/
  const PATH_DEFENSE_RE = /path\.resolve\b/
  const STARTS_WITH_RE = /\.startsWith\s*\(/

  const scanDirs = [path.resolve(SRC_DIR, "app/api"), path.resolve(SRC_DIR, "lib")]

  for (const dir of scanDirs) {
    const files = walkFiles(dir, ".ts")
    for (const file of files) {
      if (isTestFile(file)) continue
      const content = fs.readFileSync(file, "utf8")

      if (!FS_DELETE_RE.test(content)) continue

      // File has fs delete operations — check for path traversal defense
      const hasResolve = PATH_DEFENSE_RE.test(content)
      const hasStartsWith = STARTS_WITH_RE.test(content)

      if (!hasResolve || !hasStartsWith) {
        const rel = relativePath(file)
        const missing = []
        if (!hasResolve) missing.push("path.resolve()")
        if (!hasStartsWith) missing.push("startsWith(base + path.sep)")
        findings.push({
          file: rel,
          detail: `File performs fs delete but missing path traversal defense: ${missing.join(" and ")}`,
        })
      }
    }
  }

  return {
    id: "path-traversal-defense",
    name: "File delete operations have path traversal defense",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 22: Argon2 password hashing (critical) ─────────────────────

function checkArgon2Hashing(): CheckResult {
  const findings: Finding[] = []
  const authPath = path.join(SRC_DIR, "lib/auth.ts")

  if (!fs.existsSync(authPath)) {
    findings.push({
      file: "src/lib/auth.ts",
      detail: "Auth module not found",
    })
    return {
      id: "argon2-hashing",
      name: "Password hashing uses Argon2 (not SHA-256/bcrypt)",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const content = fs.readFileSync(authPath, "utf8")
  const rel = relativePath(authPath)

  if (!content.includes("argon2")) {
    findings.push({
      file: rel,
      detail: "No argon2 import found — password hashing may use a weaker algorithm",
    })
  }

  // Flag weak alternatives if present
  const WEAK_HASH_RE = /\b(?:createHash\s*\(\s*["'](?:sha256|sha1|md5)["']|bcrypt\.hash)\b/
  const lineNums = findAllLineNumbers(content, WEAK_HASH_RE)
  for (const line of lineNums) {
    const lineContent = content.split("\n")[line - 1]?.trim()
    if (lineContent?.startsWith("//") || lineContent?.startsWith("*")) continue
    findings.push({
      file: rel,
      line,
      detail: "Weak hashing algorithm found in auth module — use Argon2 for passwords",
    })
  }

  return {
    id: "argon2-hashing",
    name: "Password hashing uses Argon2 (not SHA-256/bcrypt)",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 23: Encrypted column writes use encrypt() (critical) ────────

const ENCRYPTED_COLUMNS = [
  "encryptedApiToken",
  "encryptedPassword",
  "encryptedUsername",
  "encryptedProxyPassword",
  "totpSecret",
]

function checkEncryptedColumnWrites(): CheckResult {
  const findings: Finding[] = []
  const routeFiles = walkFiles(API_DIR, "route.ts")

  // Patterns indicating a DB write (Drizzle insert/update/set)
  const DB_WRITE_RE = /\.(?:insert|update|set)\s*\(/

  for (const file of routeFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    const rel = relativePath(file)

    if (!DB_WRITE_RE.test(content)) continue

    for (const col of ENCRYPTED_COLUMNS) {
      // Check if this file writes to the encrypted column
      // Pattern: `col: someValue` in an object literal (Drizzle .set() or .values())
      const writePattern = new RegExp(`\\b${col}\\s*:(?!\\s*(?:true|false|null|undefined))`)
      if (!writePattern.test(content)) continue

      // File writes to an encrypted column — verify encrypt() is used
      const hasEncrypt = /\bencrypt\s*\(/.test(content) || /\breencrypt\s*\(/.test(content)

      // Allow: setting to null (clearing the field)
      const setsToNull = new RegExp(`${col}\\s*:\\s*null`).test(content)
      // Allow: setting to a string literal (lockdown revocation, sentinel values)
      const setsToLiteral = new RegExp(`${col}\\s*:\\s*["']`).test(content)
      // Allow: restore route copies ciphertext directly from backup
      const isRestoreRoute = rel.includes("backup/restore")
      // Allow: select/read-only references (not inside .set/.values)
      const hasWriteWithCol = new RegExp(`\\.(?:set|values)\\s*\\([^)]*${col}`).test(content)
      if (!hasWriteWithCol) continue

      if (!hasEncrypt && !setsToNull && !setsToLiteral && !isRestoreRoute) {
        findings.push({
          file: rel,
          detail: `Writes to encrypted column "${col}" without calling encrypt() or reencrypt()`,
        })
      }
    }
  }

  return {
    id: "encrypted-column-writes",
    name: "Encrypted columns written via encrypt()",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 24: TOTP flow integrity (critical) ─────────────────────────

function checkTotpFlowIntegrity(): CheckResult {
  const findings: Finding[] = []

  const TOTP_DIR = path.resolve(API_DIR, "auth/totp")
  if (!fs.existsSync(TOTP_DIR)) {
    findings.push({ file: "src/app/api/auth/totp/", detail: "TOTP route directory not found" })
    return {
      id: "totp-flow-integrity",
      name: "TOTP 2FA flow integrity",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  // ── verify route: must use pendingToken, NOT authenticate() ──
  const verifyPath = path.join(TOTP_DIR, "verify/route.ts")
  if (fs.existsSync(verifyPath)) {
    const content = fs.readFileSync(verifyPath, "utf8")
    const rel = relativePath(verifyPath)

    if (!/\bpendingToken\b/.test(content) || !/\bverifyPendingToken\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP verify must use pendingToken pattern (two-step login), not direct session",
      })
    }
    if (/\bauthenticate\s*\(/.test(content)) {
      findings.push({
        file: rel,
        detail:
          "TOTP verify should NOT call authenticate() — it uses pendingToken for mid-login auth",
      })
    }
    if (!/\brecordFailedAttempt\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP verify must increment failed attempts on invalid code (auto-wipe defense)",
      })
    }
    if (!/BACKUP_CODE_PATTERN/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP verify must validate backup code format before crypto operations",
      })
    }
    if (!/\bverifyAndConsumeBackupCode\b/.test(content)) {
      findings.push({
        file: rel,
        detail:
          "TOTP verify must use single-use backup code consumption (verifyAndConsumeBackupCode)",
      })
    }
    if (!/\bcreateSession\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP verify must issue session only after successful code verification",
      })
    }
  } else {
    findings.push({
      file: "src/app/api/auth/totp/verify/route.ts",
      detail: "TOTP verify route not found",
    })
  }

  // ── setup route: must require session, must use setupToken ──
  const setupPath = path.join(TOTP_DIR, "setup/route.ts")
  if (fs.existsSync(setupPath)) {
    const content = fs.readFileSync(setupPath, "utf8")
    const rel = relativePath(setupPath)

    if (!/\bauthenticate\s*\(/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP setup must require active session via authenticate()",
      })
    }
    if (!/\bcreateSetupToken\b/.test(content)) {
      findings.push({
        file: rel,
        detail:
          "TOTP setup must use a short-lived setup token (createSetupToken), not store secret directly",
      })
    }
    if (!/\bgenerateBackupCodes\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP setup must generate backup codes during enrollment",
      })
    }
  } else {
    findings.push({
      file: "src/app/api/auth/totp/setup/route.ts",
      detail: "TOTP setup route not found",
    })
  }

  // ── confirm route: must require session + setupToken + code verification ──
  const confirmPath = path.join(TOTP_DIR, "confirm/route.ts")
  if (fs.existsSync(confirmPath)) {
    const content = fs.readFileSync(confirmPath, "utf8")
    const rel = relativePath(confirmPath)

    if (!/\bauthenticate\s*\(/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP confirm must require active session via authenticate()",
      })
    }
    if (!/\bverifySetupToken\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP confirm must verify the setup token (verifySetupToken)",
      })
    }
    if (!/\bverifyTotpCode\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP confirm must verify a TOTP code before saving the secret",
      })
    }
    if (!/\bencrypt\s*\(/.test(content)) {
      findings.push({ file: rel, detail: "TOTP confirm must encrypt the secret before DB storage" })
    }
  } else {
    findings.push({
      file: "src/app/api/auth/totp/confirm/route.ts",
      detail: "TOTP confirm route not found",
    })
  }

  // ── disable route: must require session + password + code ──
  const disablePath = path.join(TOTP_DIR, "disable/route.ts")
  if (fs.existsSync(disablePath)) {
    const content = fs.readFileSync(disablePath, "utf8")
    const rel = relativePath(disablePath)

    if (!/\bauthenticate\s*\(/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP disable must require active session via authenticate()",
      })
    }
    if (!/\bverifyPassword\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP disable must require master password re-verification",
      })
    }
    if (!/\bverifyTotpCode\b/.test(content) && !/\bverifyAndConsumeBackupCode\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP disable must require a valid TOTP or backup code as proof of possession",
      })
    }
    if (!/\brecordFailedAttempt\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "TOTP disable must increment failed attempts on invalid code/password",
      })
    }
  } else {
    findings.push({
      file: "src/app/api/auth/totp/disable/route.ts",
      detail: "TOTP disable route not found",
    })
  }

  // ── totp.ts library: must use timing-safe comparison for backup codes ──
  const totpLibPath = path.join(SRC_DIR, "lib/totp.ts")
  if (fs.existsSync(totpLibPath)) {
    const content = fs.readFileSync(totpLibPath, "utf8")
    const rel = relativePath(totpLibPath)

    if (!/\btimingSafeEqual\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "Backup code verification must use timingSafeEqual for comparison",
      })
    }
    if (!/\bused\s*:\s*true\b/.test(content)) {
      findings.push({
        file: rel,
        detail: "Backup code consumption must mark codes as used (single-use enforcement)",
      })
    }
  } else {
    findings.push({ file: "src/lib/totp.ts", detail: "TOTP library not found" })
  }

  return {
    id: "totp-flow-integrity",
    name: "TOTP 2FA flow integrity",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 25: Emergency lockdown flow integrity (critical) ────────────

function checkLockdownFlowIntegrity(): CheckResult {
  const findings: Finding[] = []
  const lockdownPath = path.join(API_DIR, "settings/lockdown/route.ts")

  if (!fs.existsSync(lockdownPath)) {
    findings.push({
      file: "src/app/api/settings/lockdown/route.ts",
      detail: "Lockdown route not found",
    })
    return {
      id: "lockdown-flow-integrity",
      name: "Emergency lockdown flow integrity",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const content = fs.readFileSync(lockdownPath, "utf8")
  const rel = relativePath(lockdownPath)

  if (!/\bauthenticate\s*\(/.test(content)) {
    findings.push({ file: rel, detail: "Lockdown must require active session via authenticate()" })
  }
  if (!/\bstopScheduler\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Lockdown must stop the scheduler (key zeroing + poll termination)",
    })
  }
  if (!/encryptedApiToken/.test(content)) {
    findings.push({ file: rel, detail: "Lockdown must revoke all tracker API tokens" })
  }
  if (!/\bgenerateSalt\b/.test(content) && !/encryptionSalt/.test(content)) {
    findings.push({
      file: rel,
      detail: "Lockdown must rotate encryption salt (orphan existing ciphertext)",
    })
  }
  if (!/totpSecret\s*:\s*null/.test(content)) {
    findings.push({ file: rel, detail: "Lockdown must clear TOTP secret" })
  }

  return {
    id: "lockdown-flow-integrity",
    name: "Emergency lockdown flow integrity",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 26: Scrub & delete (nuke) flow integrity (critical) ─────────

function checkNukeFlowIntegrity(): CheckResult {
  const findings: Finding[] = []
  const nukePath = path.join(API_DIR, "settings/nuke/route.ts")

  if (!fs.existsSync(nukePath)) {
    findings.push({ file: "src/app/api/settings/nuke/route.ts", detail: "Nuke route not found" })
    return {
      id: "nuke-flow-integrity",
      name: "Scrub & delete (nuke) flow integrity",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const content = fs.readFileSync(nukePath, "utf8")
  const rel = relativePath(nukePath)

  if (!/\bauthenticate\s*\(/.test(content)) {
    findings.push({ file: rel, detail: "Nuke must require active session via authenticate()" })
  }
  if (!/\bverifyPassword\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Nuke must require master password re-verification (intent confirmation)",
    })
  }
  if (!/\bscrubAndDeleteAll\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Nuke must use scrubAndDeleteAll() for forensic-resistant deletion",
    })
  }

  return {
    id: "nuke-flow-integrity",
    name: "Scrub & delete (nuke) flow integrity",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 27: Backup restore flow integrity (critical) ────────────────

function checkBackupRestoreIntegrity(): CheckResult {
  const findings: Finding[] = []
  const restorePath = path.join(API_DIR, "settings/backup/restore/route.ts")

  if (!fs.existsSync(restorePath)) {
    findings.push({
      file: "src/app/api/settings/backup/restore/route.ts",
      detail: "Restore route not found",
    })
    return {
      id: "backup-restore-integrity",
      name: "Backup restore flow integrity",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const content = fs.readFileSync(restorePath, "utf8")
  const rel = relativePath(restorePath)

  if (!/\bauthenticate\s*\(/.test(content)) {
    findings.push({ file: rel, detail: "Restore must require active session via authenticate()" })
  }
  if (!/\bverifyPassword\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Restore must require master password re-verification (intent confirmation)",
    })
  }
  if (!/\bstopScheduler\b/.test(content)) {
    findings.push({ file: rel, detail: "Restore must stop the scheduler before modifying data" })
  }
  // passwordHash must never be overwritten from backup
  if (
    /passwordHash\s*:(?!\s*(?:undefined|null))/.test(content) &&
    !/passwordHash.*exclude|exclude.*passwordHash/i.test(content)
  ) {
    // More specific: check that passwordHash is not in any .set() or .values() call
    if (/\.(?:set|values)\s*\([^)]*passwordHash/.test(content)) {
      findings.push({
        file: rel,
        detail: "Restore must NEVER overwrite passwordHash from backup data",
      })
    }
  }
  // failedLoginAttempts must be reset to 0
  if (!/failedLoginAttempts\s*:\s*0/.test(content)) {
    findings.push({
      file: rel,
      detail: "Restore must reset failedLoginAttempts to 0 (clear lockout state)",
    })
  }
  // Must use a transaction
  if (!/\btransaction\b/.test(content) && !/\.transaction\s*\(/.test(content)) {
    findings.push({
      file: rel,
      detail: "Restore must run inside a database transaction (rollback on failure)",
    })
  }
  // Restore SHOULD call recordFailedAttempt — a wrong password on restore is a
  // brute-force vector (attacker with backup file guessing the master password).
  // The restore route also checks lockedUntil, so progressive lockout applies.
  if (!/\brecordFailedAttempt\s*\(/.test(content)) {
    findings.push({
      file: rel,
      detail:
        "Restore must call recordFailedAttempt() on invalid password (brute-force protection)",
    })
  }
  // Must validate backup before destructive operations
  if (!/\bvalidateBackupJson\b/.test(content) && !/\bvalidateBackup\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Restore must validate backup structure before any destructive operations",
    })
  }

  return {
    id: "backup-restore-integrity",
    name: "Backup restore flow integrity",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Check 28: Login flow integrity (critical) ─────────────────────────

function checkLoginFlowIntegrity(): CheckResult {
  const findings: Finding[] = []
  const loginPath = path.join(API_DIR, "auth/login/route.ts")

  if (!fs.existsSync(loginPath)) {
    findings.push({ file: "src/app/api/auth/login/route.ts", detail: "Login route not found" })
    return {
      id: "login-flow-integrity",
      name: "Login flow integrity",
      severity: "critical",
      status: "fail",
      findings,
    }
  }

  const content = fs.readFileSync(loginPath, "utf8")
  const rel = relativePath(loginPath)

  // Login must NOT call authenticate() — it IS the auth entry point
  if (/\bauthenticate\s*\(/.test(content)) {
    findings.push({
      file: rel,
      detail: "Login must NOT call authenticate() — it is the public auth entry point",
    })
  }
  if (!/\bverifyPassword\b/.test(content)) {
    findings.push({ file: rel, detail: "Login must verify password via verifyPassword() (Argon2)" })
  }
  if (!/\brecordFailedAttempt\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Login must increment failed attempts on invalid password (auto-wipe defense)",
    })
  }
  if (!/\bresetFailedAttempts\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Login must reset failed attempts counter on successful authentication",
    })
  }
  if (!/\bderiveKey\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Login must derive encryption key from password via deriveKey() (scrypt)",
    })
  }
  if (!/\bcreateSession\b/.test(content)) {
    findings.push({ file: rel, detail: "Login must issue session via createSession()" })
  }
  // Must support TOTP two-step flow
  if (!/\bpendingToken\b/i.test(content) && !/\bcreatePendingToken\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Login must support TOTP two-step flow via pending token when 2FA is enabled",
    })
  }
  if (!/\bstartScheduler\b/.test(content)) {
    findings.push({
      file: rel,
      detail: "Login must start the scheduler with the derived encryption key",
    })
  }

  return {
    id: "login-flow-integrity",
    name: "Login flow integrity",
    severity: "critical",
    status: findings.length === 0 ? "pass" : "fail",
    findings,
  }
}

// ── Run all checks ──────────────────────────────────────────────────────

function runAudit(changedFiles?: string[]): AuditOutput {
  const absChangedFiles = changedFiles?.map((f) => (path.isAbsolute(f) ? f : path.resolve(ROOT, f)))

  const results: CheckResult[] = [
    // Critical — fail the PR
    checkAuthEnforcement(),
    checkDangerousFunctions(absChangedFiles),
    checkHardcodedSecrets(absChangedFiles),
    checkSecurityHeaders(),
    checkCookieSecurity(),
    checkSensitiveFieldExposure(),
    checkEnvFiles(),
    checkRawSqlInRoutes(),
    checkUnsafeRedirectFetch(),
    checkTimingSafeComparison(),
    checkNoRawMigrations(),
    checkFetchTimeout(),
    checkDockerfileNonRoot(),
    checkProxyAllowlistSync(),
    checkPathTraversalDefense(),
    checkArgon2Hashing(),
    checkEncryptedColumnWrites(),
    checkTotpFlowIntegrity(),
    checkLockdownFlowIntegrity(),
    checkNukeFlowIntegrity(),
    checkBackupRestoreIntegrity(),
    checkLoginFlowIntegrity(),
    // Warning — flag but don't fail
    checkConsoleLogInRoutes(absChangedFiles),
    checkTodoInSecurityFiles(),
    checkUnvalidatedJsonParse(absChangedFiles),
    checkBareCatchBlocks(absChangedFiles),
    checkRequestBodySize(absChangedFiles),
    checkBigIntSafety(absChangedFiles),
  ]

  const finalResults = filterIgnoredFindings(results)

  const critical = finalResults.filter(
    (r) => r.severity === "critical" && r.status === "fail"
  ).length
  const warning = finalResults.filter((r) => r.severity === "warning" && r.status === "fail").length
  const passed = finalResults.filter((r) => r.status === "pass").length

  return {
    results: finalResults,
    summary: { critical, warning, passed, total: finalResults.length },
  }
}

// ── CLI entry ───────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const changedOnlyIdx = args.indexOf("--changed-only")
const changedFiles = changedOnlyIdx >= 0 ? args.slice(changedOnlyIdx + 1) : undefined

const output = runAudit(changedFiles)

console.log(JSON.stringify(output, null, 2))

process.exit(output.summary.critical > 0 ? 1 : 0)
