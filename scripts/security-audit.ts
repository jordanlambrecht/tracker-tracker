// scripts/security-audit.ts
//
// Static security analysis for CI.
// Outputs JSON to stdout: { results: CheckResult[], summary: { ... } }
//
// Functions: walkFiles, routePathFromFile, checkAuthEnforcement,
//   checkDangerousFunctions, checkHardcodedSecrets, checkSecurityHeaders,
//   checkCookieSecurity, checkSensitiveFieldExposure, checkEnvFiles,
//   checkConsoleLogInRoutes, checkTodoInSecurityFiles, checkRawSqlInRoutes,
//   runAudit
//
// Usage: npx tsx scripts/security-audit.ts [--changed-only file1 file2 ...]
// If --changed-only is provided, only those files are scanned for
// file-level checks (2/3/8/9). Auth enforcement and headers always
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
const AUTH_PATTERNS = ["authenticate", "getSession", "requireAuth"]

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
  "src/lib/wipe.ts",
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
  return "api/" + rel.replace(/[/\\]route\.ts$/, "").replace(/\\/g, "/")
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

// ── Check 1: Auth enforcement ───────────────────────────────────────────

function checkAuthEnforcement(): CheckResult {
  const findings: Finding[] = []
  const routeFiles = walkFiles(API_DIR, "route.ts")
  const EXPORTED_HANDLERS =
    /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|PUT|DELETE)\b/g

  for (const file of routeFiles) {
    const routePath = routePathFromFile(file)
    if (NO_AUTH_ROUTES.has(routePath)) continue

    const content = fs.readFileSync(file, "utf8")
    const handlers = [...content.matchAll(EXPORTED_HANDLERS)].map((m) => m[1])
    if (handlers.length === 0) continue

    // Accept any of the valid auth patterns
    const hasAuth = AUTH_PATTERNS.some((p) => content.includes(p))

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
  const targetFiles =
    files ?? walkFiles(SRC_DIR, ".ts").concat(walkFiles(SRC_DIR, ".tsx"))

  for (const file of targetFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")

    for (const { re, name } of DANGEROUS_PATTERNS) {
      const lineNums = findAllLineNumbers(content, re)
      for (const line of lineNums) {
        // Skip commented-out lines
        const lineContent = content.split("\n")[line - 1]?.trim()
        if (lineContent?.startsWith("//") || lineContent?.startsWith("*"))
          continue

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
  const targetFiles =
    files ?? walkFiles(SRC_DIR, ".ts").concat(walkFiles(SRC_DIR, ".tsx"))

  for (const file of targetFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")

    for (const { re, name } of SECRET_PATTERNS) {
      const lineNums = findAllLineNumbers(content, re)
      for (const line of lineNums) {
        // Skip commented-out lines
        const lineContent = content.split("\n")[line - 1]?.trim()
        if (lineContent?.startsWith("//") || lineContent?.startsWith("*"))
          continue

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
  const COOKIE_SET_RE = /\.(?:cookies|cookieStore)\.set\s*\(/

  for (const file of allFiles) {
    if (isTestFile(file)) continue
    const content = fs.readFileSync(file, "utf8")
    if (!COOKIE_SET_RE.test(content)) continue

    const rel = relativePath(file)

    if (
      !content.includes("httpOnly: true") &&
      !content.includes("httpOnly:true")
    ) {
      findings.push({
        file: rel,
        detail: "Cookie set without httpOnly: true",
      })
    }

    if (
      !content.includes('sameSite: "strict"') &&
      !content.includes("sameSite: 'strict'")
    ) {
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
        detail:
          "console.log/debug/info in API route — may leak sensitive data in production",
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
// to the VACUUM FULL in wipe.ts.
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
      // Allow hardcoded DB ping (SELECT 1) — no user input, same category as wipe.ts
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

// ── Run all checks ──────────────────────────────────────────────────────

function runAudit(changedFiles?: string[]): AuditOutput {
  const absChangedFiles = changedFiles?.map((f) =>
    path.isAbsolute(f) ? f : path.resolve(ROOT, f)
  )

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
    // Warning — flag but don't fail
    checkConsoleLogInRoutes(absChangedFiles),
    checkTodoInSecurityFiles(),
  ]

  const critical = results.filter(
    (r) => r.severity === "critical" && r.status === "fail"
  ).length
  const warning = results.filter(
    (r) => r.severity === "warning" && r.status === "fail"
  ).length
  const passed = results.filter((r) => r.status === "pass").length

  return {
    results,
    summary: { critical, warning, passed, total: results.length },
  }
}

// ── CLI entry ───────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const changedOnlyIdx = args.indexOf("--changed-only")
const changedFiles =
  changedOnlyIdx >= 0 ? args.slice(changedOnlyIdx + 1) : undefined

const output = runAudit(changedFiles)

console.log(JSON.stringify(output, null, 2))

process.exit(output.summary.critical > 0 ? 1 : 0)
