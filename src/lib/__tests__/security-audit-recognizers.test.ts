// src/lib/__tests__/security-audit-recognizers.test.ts
//
// Tests the recognizers scripts/security-audit.ts uses for checks 6, 12, 17, 19,
// 29, 37 and 38. They live in scripts/security-audit-lib.ts so this suite can
// import them without the audit script's CLI entry running.
//
// Functions:
//   - describe("fetch argument window")
//   - describe("catch body recognizer")
//   - describe("cookie injection guard recognizer")
//   - describe("adapter credential logging detector")
//   - describe("auth result gate recognizer")
//   - describe("encrypt assignment recognizer")
//   - describe("proxy matcher exclusions")
//   - describe("authenticate before body read")
//   - describe("handler extractor")

import fs from "node:fs"
import path from "node:path"
import { Worker } from "node:worker_threads"
import { describe, expect, it } from "vitest"
import {
  authenticatesBeforeBodyRead,
  CATCH_BODY_MAX_LINES,
  catchBodyLines,
  extractHandlerBodies,
  FETCH_WINDOW_MAX_LINES,
  fetchWindowEnd,
  gatesAuthResult,
  hasInjectionGuard,
  logsCredential,
  matcherSkippedApiRoutes,
  stripEncryptAssignment,
  swallowsError,
} from "../../../scripts/security-audit-lib"

const REPO_ROOT = path.resolve(__dirname, "../../..")

// Every file in the audit's scan that interpolates into a Cookie header. Read
// from disk so the recognizer stays tied to the guards the repo ships, not to
// a copy of them.
const GUARDED_FILES = [
  "src/lib/tracker-platforms/adapters/digitalcore.ts",
  "src/lib/tracker-platforms/adapters/mam.ts",
  "src/lib/download-clients/qbt/transport.ts",
]

describe("fetch argument window", () => {
  it("a single line call is its own window", () => {
    const lines = [
      `const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })`,
      `return res.json()`,
    ]

    expect(fetchWindowEnd(lines, 0)).toBe(0)
  })

  it("the window ends on the line that closes the fetch call", () => {
    const lines = [
      `const res = await fetch(url, {`,
      `  headers: buildHeaders(creds),`,
      `  signal: AbortSignal.timeout(10_000),`,
      `})`,
      `const body = await res.text()`,
    ]

    expect(fetchWindowEnd(lines, 0)).toBe(3)
  })

  it("a parenthesis inside a string argument widens the window no further than the 60 line cap", () => {
    const lines = [`await fetch(url, { note: "(", `, ...Array.from({ length: 200 }, () => `  pad`)]

    const end = fetchWindowEnd(lines, 0)

    expect(end).toBe(FETCH_WINDOW_MAX_LINES - 1)
    expect(lines.slice(0, end + 1)).toHaveLength(FETCH_WINDOW_MAX_LINES)
  })

  it("a parenthesis inside a comment widens the window no further than the 60 line cap", () => {
    const lines = [
      `await fetch(url, {`,
      `  // retried by the caller (see scheduler`,
      `  method: "GET",`,
    ]
    const padded = [...lines, ...Array.from({ length: 200 }, () => `  pad`)]

    expect(fetchWindowEnd(padded, 0)).toBe(FETCH_WINDOW_MAX_LINES - 1)
  })

  it("the cap counts from the fetch line, not from the start of the file", () => {
    const lines = [
      `const url = buildUrl()`,
      `await fetch(url, { note: "(", `,
      ...Array.from({ length: 200 }, () => `  pad`),
    ]

    expect(fetchWindowEnd(lines, 1)).toBe(FETCH_WINDOW_MAX_LINES)
  })
})

describe("catch body recognizer", () => {
  it("a return after the block closes does not count as handling", () => {
    const lines = [`  } catch {`, `    // Keep the homepage stats.`, `  }`, `  return stats`]

    expect(swallowsError(lines, 0)).toBe(true)
  })

  it("a return inside the block counts as handling", () => {
    const lines = [`  } catch {`, `    return null`, `  }`]

    expect(swallowsError(lines, 0)).toBe(false)
  })

  it("a one-line catch that logs is read from its own line", () => {
    const lines = [`  } catch (err) { log.warn({ err }, "profile failed") }`, `  const next = 1`]

    expect(swallowsError(lines, 0)).toBe(false)
  })

  it("an empty one-line catch is flagged even when a throw follows it", () => {
    const lines = [`    } catch {}`, `    throw new Error("Tracker API error")`]

    expect(swallowsError(lines, 0)).toBe(true)
  })

  it("a nested block does not end the body early", () => {
    const lines = [
      `  } catch (err) {`,
      `    if (err instanceof TypeError) {`,
      `      fallback = { reason: "type" }`,
      `    }`,
      `    log.warn({ err }, "profile failed")`,
      `  }`,
    ]

    expect(swallowsError(lines, 0)).toBe(false)
  })

  it("a finally block on the closing line is not read as handling", () => {
    const lines = [`  } catch {`, `    copied = false`, `  } finally { log.warn("fallback used") }`]

    expect(swallowsError(lines, 0)).toBe(true)
  })

  it("an unbalanced brace inside a string stops at the 60 line cap", () => {
    const lines = [
      `  } catch {`,
      `    const open = "{"`,
      ...Array.from({ length: 200 }, () => `    pad`),
    ]

    expect(catchBodyLines(lines, 0)).toHaveLength(CATCH_BODY_MAX_LINES)
  })
})

describe("cookie injection guard recognizer", () => {
  it.each(GUARDED_FILES)("accepts the guard %s carries", (relPath) => {
    const content = fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8")

    expect(hasInjectionGuard(content)).toBe(true)
  })

  it("a guard that is named but not written is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /nothing/\n`)).toBe(false)
  })

  it("a character class that appears only in a comment is rejected", () => {
    const content = `// values are checked against [;\\r\\n] before interpolation\nconst ok = true\n`

    expect(hasInjectionGuard(content)).toBe(false)
  })

  it("a character class inside a block comment is rejected", () => {
    const content = `/**\n * rejects [;\\r\\n\\x00]\n */\nconst ok = true\n`

    expect(hasInjectionGuard(content)).toBe(false)
  })

  it("an empty character class is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[]/\n`)).toBe(false)
  })

  it("a blocklist without a control character is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[;]/\n`)).toBe(false)
  })

  it("a blocklist without a semicolon is rejected", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[\\r\\n]/\n`)).toBe(false)
  })

  it("a blocklist holding a semicolon and a control character is accepted", () => {
    expect(hasInjectionGuard(`const unsafeChars = /[;\\r\\n\\x00-\\x1F]/\n`)).toBe(true)
  })

  it("a hex allowlist is accepted without a semicolon", () => {
    expect(hasInjectionGuard(`if (/[^a-fA-F0-9]/.test(sid)) throw new Error("bad")\n`)).toBe(true)
  })
})

describe("adapter credential logging detector", () => {
  it("a pino call that puts a credential in the log object is flagged", () => {
    expect(logsCredential(`log.warn({ apiToken }, "poll failed")`)).toBe(true)
  })

  it.each(["debug", "info", "warn", "error"])(
    "a pino %s call carrying cookies is flagged",
    (level) => {
      expect(logsCredential(`log.${level}({ cookies }, "session replaced")`)).toBe(true)
    }
  )

  it("a console call that puts a credential in the log object is flagged", () => {
    expect(logsCredential(`console.error("login failed for", creds.uid)`)).toBe(true)
  })

  it("a log call that carries only the error is not flagged", () => {
    expect(
      logsCredential(`log.warn({ err }, "digitalcore: enrichment failed, core stats kept")`)
    ).toBe(false)
  })

  it("a field name that merely ends in a credential name is not flagged", () => {
    expect(logsCredential(`log.info({ hasCookies }, "session restored")`)).toBe(false)
  })
})

describe("auth result gate recognizer", () => {
  const logout = fs.readFileSync(path.join(REPO_ROOT, "src/app/api/auth/logout/route.ts"), "utf8")

  it("accepts logout's null check, since logout signs out a stale session too", () => {
    expect(gatesAuthResult("api/auth/logout", logout)).toBe(true)
  })

  it("refuses the same null check on any other route, since a stale session is truthy", () => {
    expect(gatesAuthResult("api/trackers", logout)).toBe(false)
  })

  it("accepts a readSession() caller that checks for a valid status", () => {
    const body = `const session = await readSession()\nif (session?.status !== "valid") return unauthorized()\n`

    expect(gatesAuthResult("api/trackers", body)).toBe(true)
  })

  it("refuses a status check that is commented out", () => {
    const body = `const session = await readSession()\n// if (session?.status !== "valid") return unauthorized()\n`

    expect(gatesAuthResult("api/trackers", body)).toBe(false)
  })
})

describe("encrypt assignment recognizer", () => {
  it.each([
    "    const encryptedConfig = encrypt(JSON.stringify(config), key)",
    "    updates.encryptedConfig = encrypt(JSON.stringify(fields.config), getKey())",
  ])("strips the storage prefix from %j", (line) => {
    expect(stripEncryptAssignment(line)).not.toContain("JSON.stringify")
  })

  it("keeps a property line, since it can sit inside a multi-line NextResponse.json", () => {
    const line = "      encryptedConfig: encrypt(JSON.stringify(config), key),"

    expect(stripEncryptAssignment(line)).toBe(line)
  })
})

describe("proxy matcher exclusions", () => {
  const matcher = (entries: string) => `matcher: ["/((?!${entries}).*)"]`

  it("reads the plain API routes of every lookahead", () => {
    const proxy = `${matcher("_next/static|api/a$")}\nother: ["/((?!favicon.png|api/b/c$).*)"]`

    expect(matcherSkippedApiRoutes(proxy)).toEqual({ routes: ["api/a", "api/b/c"], unaudited: [] })
  })

  it("leaves out only the restore route in the matcher the repo ships", () => {
    const proxy = fs.readFileSync(path.join(REPO_ROOT, "src/proxy.ts"), "utf8")

    expect(matcherSkippedApiRoutes(proxy)).toEqual({
      routes: ["api/settings/backup/restore"],
      unaudited: [],
    })
  })

  it("keeps a nested group whole instead of stopping at its parenthesis", () => {
    expect(matcherSkippedApiRoutes(matcher("api/(a|b)$|api/c$"))).toEqual({
      routes: ["api/c"],
      unaudited: ["api/(a|b)$"],
    })
  })

  it("adds nothing for a lookahead that only a comment mentions", () => {
    const proxy = `// a lookahead such as (?!.*foo) leaves paths out\n/* (?!api) too */\n${matcher("api/a$")}`

    expect(matcherSkippedApiRoutes(proxy)).toEqual({ routes: ["api/a"], unaudited: [] })
  })

  it.each([
    ["a group", "api/(?:a|b)$"],
    ["a wildcard pattern", ".*restore$"],
    ["an API prefix without $", "api/settings"],
    ["a prefix of every API route", "api"],
    ["a dot standing in for a letter", "ap."],
    ["an empty alternative", ""],
  ])("reports %s as too complex to audit", (_, entry) => {
    expect(matcherSkippedApiRoutes(matcher(`_next/static|${entry}`)).unaudited).toEqual([entry])
  })
})

describe("authenticate before body read", () => {
  const GATE =
    "  const auth = await authenticate()\n  if (auth instanceof NextResponse) return auth\n"
  const handler = (body: string, method = "POST", param = "request") =>
    `export async function ${method}(${param}: Request) {\n${body}}\n`

  it("passes the restore route, whose handler gates before runRestore reads the body", () => {
    const route = fs.readFileSync(
      path.join(REPO_ROOT, "src/app/api/settings/backup/restore/route.ts"),
      "utf8"
    )

    expect(authenticatesBeforeBodyRead(route)).toBe(true)
  })

  it.each([
    ["gates, then reads the body", `${GATE}  const form = await request.formData()\n`],
    ["gates and never reads the body", `${GATE}  return NextResponse.json({})\n`],
    [
      "gates with braces",
      "  const auth = await authenticate()\n  if (auth instanceof NextResponse) {\n    return auth\n  }\n  await request.json()\n",
    ],
  ])("passes a handler that %s", (_, body) => {
    expect(authenticatesBeforeBodyRead(handler(body))).toBe(true)
  })

  it.each([
    [
      "a GET that gates while POST reads first",
      handler(GATE, "GET") + handler(`  await request.formData()\n${GATE}`),
    ],
    [
      "authenticate() in a helper called after the read",
      handler(
        "  await request.formData()\n  const auth = await requireAuth()\n  if (auth instanceof NextResponse) return auth\n"
      ),
    ],
    [
      "the call before the read but the gate after it",
      handler(
        "  const p = authenticate()\n  await request.formData()\n  const auth = await p\n  if (auth instanceof NextResponse) return auth\n"
      ),
    ],
    [
      "the gate inside a string",
      handler(
        '  log("const auth = await authenticate(); if (auth instanceof NextResponse) return auth")\n  await request.formData()\n'
      ),
    ],
    [
      "the gate inside a template literal",
      handler(
        "  log(`const auth = await authenticate(); if (auth instanceof NextResponse) return auth`)\n  await request.formData()\n"
      ),
    ],
    [
      "the gate inside a comment",
      handler(
        "  // const auth = await authenticate(); if (auth instanceof NextResponse) return auth\n  await request.formData()\n"
      ),
    ],
    ["request.clone().json()", handler(`  await request.clone().json()\n${GATE}`)],
    [
      "(request as NextRequest).json()",
      handler(`  await (request as NextRequest).json()\n${GATE}`),
    ],
    ["request?.json()", handler(`  await request?.json()\n${GATE}`)],
    ["another parameter name", handler(`  await incoming.formData()\n${GATE}`, "POST", "incoming")],
    ["a destructured body", handler(`  const { body } = request\n${GATE}`)],
    ["parseJsonBody()", handler(`  const data = await parseJsonBody(request)\n${GATE}`)],
    [
      "a parseRouteId gate before the read",
      handler(
        `  const id = await parseRouteId(params, "tracker")\n  if (id instanceof NextResponse) return id\n  await request.json()\n${GATE}`
      ),
    ],
    [
      "a URL string on the line of the read",
      handler(`  const origin = "http://localhost"; await request.formData()\n${GATE}`),
    ],
    ["no gate at all", handler("  return NextResponse.json({})\n")],
    [
      "no handler the extractor can see",
      `export const POST = async (request: Request) => {\n${GATE}}\n`,
    ],
    [
      "an OPTIONS that reads before its gate beside a gated POST",
      handler(GATE) + handler(`  await request.formData()\n${GATE}`, "OPTIONS"),
    ],
    [
      "a HEAD that reads before its gate beside a gated POST",
      handler(GATE) + handler(`  await request.text()\n${GATE}`, "HEAD"),
    ],
  ])("fails %s", (_, source) => {
    expect(authenticatesBeforeBodyRead(source)).toBe(false)
  })
})

describe("handler extractor", () => {
  // Room for a loaded machine. When nothing is wrong the worker answers in milliseconds.
  const WORKER_KILL_MS = 4_000
  const WORKER_TEST_TIMEOUT_MS = 10_000

  // A scan that never ends blocks the thread, so no test timeout could stop it here.
  // In a worker it can be ended, and the test fails instead of hanging the suite.
  function extractInWorker(content: string): Promise<unknown> {
    const worker = new Worker(
      `const { parentPort, workerData } = require("node:worker_threads")
       const extract = ${extractHandlerBodies.toString()}
       parentPort.postMessage(extract(workerData))`,
      { eval: true, workerData: content }
    )
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void worker.terminate()
        reject(new Error(`the scan did not finish within ${WORKER_KILL_MS} ms`))
      }, WORKER_KILL_MS)
      worker.once("message", (result) => {
        clearTimeout(timer)
        void worker.terminate()
        resolve(result)
      })
      worker.once("error", (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  it(
    "reads a handler in the worker the way it does in the test",
    async () => {
      const content = "export async function GET() {\n  return 1\n}\n"

      await expect(extractInWorker(content)).resolves.toEqual(extractHandlerBodies(content))
    },
    WORKER_TEST_TIMEOUT_MS
  )

  it.each([
    ["no parameter list", "export function GET"],
    ["no body", "export function GET()"],
  ])(
    "returns no handler for one with %s at the end of the file",
    async (_, content) => {
      await expect(extractInWorker(content)).resolves.toEqual([])
    },
    WORKER_TEST_TIMEOUT_MS
  )
})
