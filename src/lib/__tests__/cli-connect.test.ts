// src/lib/__tests__/cli-connect.test.ts
//
// Runs scripts/recover.cjs and scripts/backfill-buffer.cjs as the image does,
// up to their first database call. reset-password.test.ts and
// backfill-buffer.test.ts load the same files but only call the pure helpers,
// so a require("postgres") that returns the wrong shape passes there. That is
// what postgres.js 4 did: it is an ES module, require() returns its namespace,
// and both CLIs died with "postgres is not a function" before opening a socket.
//
// DATABASE_URL points at a 127.0.0.1 port that was just released, so the
// connection is refused at once and no database is needed. ECONNREFUSED is
// proof the client was built and tried to connect.
//
// The guard cases seed require.cache from an --import preload with a postgres
// whose default export is not a function, and check that --help already fails.
// --help is all the docker.yml smoke step runs, and it never reaches postgres().

// @vitest-environment node

import { spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"

const SESSION_SECRET = "cli-connect-test-session-secret-not-a-real-one"

/** Bind an ephemeral port, then release it, so nothing listens there. */
async function closedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (address === null || typeof address === "string") throw new Error("no TCP port bound")
  return address.port
}

function scriptPath(script: string): string {
  return fileURLToPath(new URL(`../../../scripts/${script}`, import.meta.url))
}

/** A data: URL preload that makes require("postgres") return { default: {} } for this script. */
function wrongShapePreload(script: string): string {
  const code = [
    'import { createRequire } from "node:module"',
    `const require = createRequire(${JSON.stringify(pathToFileURL(scriptPath(script)).href)})`,
    'const target = require.resolve("postgres")',
    "require.cache[target] = { id: target, filename: target, loaded: true, exports: { default: {} } }",
  ].join("\n")
  return `data:text/javascript,${encodeURIComponent(code)}`
}

async function runCli(script: string, args: string[], nodeArgs: string[] = []) {
  const port = await closedPort()
  return spawnSync(process.execPath, [...nodeArgs, scriptPath(script), ...args], {
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://cli-test@127.0.0.1:${port}/cli_test`,
      SESSION_SECRET,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20_000,
  })
}

describe("CLI database connection", () => {
  it("recover.cjs --check builds a client and fails on the refused connection", async () => {
    const result = await runCli("recover.cjs", ["--check"])

    expect(result.error).toBeUndefined()
    expect(result.stderr).not.toMatch(/is not a function/)
    expect(result.stderr).toMatch(/ECONNREFUSED/)
    expect(result.status).toBe(1)
  }, 30_000)

  it("backfill-buffer.cjs builds a client and fails on the refused connection", async () => {
    const result = await runCli("backfill-buffer.cjs", [])

    expect(result.error).toBeUndefined()
    expect(result.stderr).not.toMatch(/is not a function/)
    expect(result.stderr).toMatch(/ECONNREFUSED/)
    expect(result.status).toBe(1)
  }, 30_000)
})

describe("postgres shape guard", () => {
  it.each(["recover.cjs", "backfill-buffer.cjs"])(
    "%s --help fails when the postgres default export is not a function",
    async (script) => {
      const result = await runCli(script, ["--help"], ["--import", wrongShapePreload(script)])

      expect(result.error).toBeUndefined()
      expect(result.stderr).toMatch(/postgres\.js default export is not a function/)
      expect(result.stdout).not.toMatch(/USAGE/)
      expect(result.status).toBe(1)
    },
    30_000
  )
})
