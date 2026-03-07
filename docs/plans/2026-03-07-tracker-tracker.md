# Tracker Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-hosted dashboard that monitors private tracker stats (upload/download over time) with encrypted API token storage, configurable polling, and a dark command-center UI.

**Architecture:** Next.js 15 App Router full-stack app. PostgreSQL stores config + time-series snapshots via Drizzle ORM. Adapter pattern abstracts tracker platforms (UNIT3D first). Master password derives AES-256-GCM key for encrypting API tokens at rest. node-cron polls each tracker at configurable intervals. ECharts renders interactive glow-themed graphs.

**Tech Stack:** Next.js 15, PostgreSQL, Drizzle ORM, ECharts, Tailwind CSS, Vitest, node-cron, Argon2, scrypt + AES-256-GCM

---

## Phase 1: Project Foundation

### Task 1: Scaffold Next.js Project

**Step 1: Create Next.js app with pnpm**

```bash
cd /Users/jordanlambrecht/dev-local/private-tracker-tracker
pnpm create next-app@latest . --typescript --tailwind --eslint=false --app --src-dir --import-alias="@/*" --use-pnpm --turbopack
```

Note: We pass `--eslint=false` because this project uses Biome for linting, not ESLint.

**Step 2: Remove ESLint config if generated, add Biome**

```bash
rm -f .eslintrc.json eslint.config.mjs
pnpm add -D @biomejs/biome
```

**Step 3: Create biome.json**

Create: `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "warn",
        "noUnusedVariables": "warn"
      }
    }
  },
  "formatter": {
    "enabled": false
  }
}
```

**Step 4: Install core dependencies**

```bash
pnpm add drizzle-orm postgres dotenv echarts echarts-for-react node-cron argon2 jose
pnpm add -D drizzle-kit @types/node-cron vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 5: Create .env.local**

Create: `.env.local`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tracker_tracker
SESSION_SECRET=change-this-to-a-random-64-char-string-in-production
```

**Step 6: Create .env.example**

Create: `.env.example`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tracker_tracker
SESSION_SECRET=change-this-to-a-random-64-char-string
```

**Step 7: Update .gitignore**

Append to `.gitignore`:

```
.env.local
.env*.local
```

**Step 8: Create docker-compose.yml for dev PostgreSQL**

Create: `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: tracker_tracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 9: Start PostgreSQL and verify**

```bash
docker compose up -d
```

**Step 10: Init git and commit**

```bash
git init
git add -A
git commit -m "scaffold next.js project with postgres, drizzle, tailwind"
```

---

### Task 2: Configure Vitest

**Step 1: Create vitest config**

Create: `vitest.config.ts`

```typescript
// vitest.config.ts
import { resolve } from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
```

**Step 2: Create test setup file**

Create: `src/test/setup.ts`

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom/vitest"
```

**Step 3: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 4: Commit**

```bash
git add -A
git commit -m "configure vitest with jsdom and path aliases"
```

---

### Task 3: Design Tokens + Tailwind Config

**Step 1: Install Google Fonts (JetBrains Mono + Inter)**

Create: `src/app/layout.tsx` (replace default)

```tsx
// src/app/layout.tsx
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Tracker Tracker",
  description: "Monitor your private tracker stats",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-base text-primary`}
      >
        {children}
      </body>
    </html>
  )
}
```

**Step 2: Configure Tailwind with design tokens**

Replace: `tailwind.config.ts`

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        base: "var(--surface-base)",
        raised: "var(--surface-raised)",
        elevated: "var(--surface-elevated)",
        overlay: "var(--surface-overlay)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        tertiary: "var(--text-tertiary)",
        muted: "var(--text-muted)",
        accent: {
          DEFAULT: "var(--accent)",
          dim: "var(--accent-dim)",
          glow: "var(--accent-glow)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          dim: "var(--warn-dim)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          dim: "var(--danger-dim)",
        },
        success: {
          DEFAULT: "var(--success)",
          dim: "var(--success-dim)",
        },
        border: {
          DEFAULT: "var(--border)",
          soft: "var(--border-soft)",
          emphasis: "var(--border-emphasis)",
        },
        control: {
          bg: "var(--control-bg)",
          border: "var(--control-border)",
          focus: "var(--control-focus)",
        },
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
        "16": "64px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        glow: "0 0 12px var(--accent-glow)",
        "glow-sm": "0 0 6px var(--accent-glow)",
        "glow-lg": "0 0 24px var(--accent-glow)",
        "glow-warn": "0 0 12px var(--warn-dim)",
        "glow-danger": "0 0 12px var(--danger-dim)",
        "glow-success": "0 0 12px var(--success-dim)",
      },
    },
  },
  plugins: [],
}

export default config
```

**Step 3: Create globals.css with CSS variables**

Replace: `src/app/globals.css`

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Surfaces — navy-black, same hue, shifting lightness */
    --surface-base: #0a0e1a;
    --surface-raised: #0f1424;
    --surface-elevated: #151b30;
    --surface-overlay: #1a2138;

    /* Text hierarchy */
    --text-primary: #e2e8f0;
    --text-secondary: #94a3b8;
    --text-tertiary: #64748b;
    --text-muted: #475569;

    /* Accent — cyan (active network connections) */
    --accent: #00d4ff;
    --accent-dim: rgba(0, 212, 255, 0.15);
    --accent-glow: rgba(0, 212, 255, 0.25);

    /* Semantic */
    --warn: #f59e0b;
    --warn-dim: rgba(245, 158, 11, 0.15);
    --danger: #ef4444;
    --danger-dim: rgba(239, 68, 68, 0.15);
    --success: #10b981;
    --success-dim: rgba(16, 185, 129, 0.15);

    /* Borders — rgba blends, not solid hex */
    --border: rgba(148, 163, 184, 0.12);
    --border-soft: rgba(148, 163, 184, 0.06);
    --border-emphasis: rgba(148, 163, 184, 0.2);

    /* Controls */
    --control-bg: #080c16;
    --control-border: rgba(148, 163, 184, 0.15);
    --control-focus: rgba(0, 212, 255, 0.5);
  }
}

/* Glow animation for pulse dots */
@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    filter: drop-shadow(0 0 4px currentColor);
  }
  50% {
    opacity: 0.7;
    filter: drop-shadow(0 0 8px currentColor);
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2.5s ease-in-out infinite;
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "add design tokens, tailwind config, and glow utilities"
```

---

### Task 4: Drizzle Schema + Database Setup

**Step 1: Create Drizzle config**

Create: `drizzle.config.ts`

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Step 2: Create database schema**

Create: `src/lib/db/schema.ts`

```typescript
// src/lib/db/schema.ts
//
// Tables: appSettings, trackers, trackerSnapshots, trackerRoles
import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  varchar,
  real,
} from "drizzle-orm/pg-core"

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  encryptionSalt: text("encryption_salt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const trackers = pgTable("trackers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: text("base_url").notNull(),
  apiPath: varchar("api_path", { length: 255 }).default("/api/user").notNull(),
  platformType: varchar("platform_type", { length: 50 }).default("unit3d").notNull(),
  encryptedApiToken: text("encrypted_api_token").notNull(),
  pollIntervalMinutes: integer("poll_interval_minutes").default(360).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastPolledAt: timestamp("last_polled_at"),
  lastError: text("last_error"),
  color: varchar("color", { length: 7 }).default("#00d4ff"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const trackerSnapshots = pgTable("tracker_snapshots", {
  id: serial("id").primaryKey(),
  trackerId: integer("tracker_id")
    .references(() => trackers.id, { onDelete: "cascade" })
    .notNull(),
  polledAt: timestamp("polled_at").defaultNow().notNull(),
  uploadedBytes: bigint("uploaded_bytes", { mode: "bigint" }).notNull(),
  downloadedBytes: bigint("downloaded_bytes", { mode: "bigint" }).notNull(),
  ratio: real("ratio"),
  bufferBytes: bigint("buffer_bytes", { mode: "bigint" }),
  seedingCount: integer("seeding_count"),
  leechingCount: integer("leeching_count"),
  seedbonus: real("seedbonus"),
  hitAndRuns: integer("hit_and_runs"),
  username: varchar("username", { length: 255 }),
  group: varchar("group_name", { length: 255 }),
})

export const trackerRoles = pgTable("tracker_roles", {
  id: serial("id").primaryKey(),
  trackerId: integer("tracker_id")
    .references(() => trackers.id, { onDelete: "cascade" })
    .notNull(),
  roleName: varchar("role_name", { length: 255 }).notNull(),
  achievedAt: timestamp("achieved_at").defaultNow().notNull(),
  notes: text("notes"),
})
```

**Step 3: Create Drizzle client**

Create: `src/lib/db/index.ts`

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)

export const db = drizzle(client, { schema })
```

**Step 4: Generate and run migration**

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

**Step 5: Add db scripts to package.json**

Add to `scripts`:

```json
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

**Step 6: Commit**

```bash
git add -A
git commit -m "add drizzle schema with four tables and postgres connection"
```

---

### Task 5: Byte Parser Utility (TDD)

This parses UNIT3D's formatted strings like `"500.25 GiB"` into raw byte counts.

**Step 1: Write failing tests**

Create: `src/lib/parser.test.ts`

```typescript
// src/lib/parser.test.ts
import { describe, it, expect } from "vitest"
import { parseBytes, formatBytes } from "./parser"

describe("parseBytes", () => {
  it("parses GiB values", () => {
    expect(parseBytes("500.25 GiB")).toBe(BigInt(537_137_266_278))
  })

  it("parses TiB values", () => {
    expect(parseBytes("1.5 TiB")).toBe(BigInt(1_649_267_441_664))
  })

  it("parses MiB values", () => {
    expect(parseBytes("100 MiB")).toBe(BigInt(104_857_600))
  })

  it("parses KiB values", () => {
    expect(parseBytes("512 KiB")).toBe(BigInt(524_288))
  })

  it("parses zero", () => {
    expect(parseBytes("0 GiB")).toBe(BigInt(0))
  })

  it("handles values with no decimal", () => {
    expect(parseBytes("50 GiB")).toBe(BigInt(53_687_091_200))
  })

  it("throws on invalid format", () => {
    expect(() => parseBytes("invalid")).toThrow()
  })

  it("handles GB (decimal) if encountered", () => {
    expect(parseBytes("500 GB")).toBe(BigInt(500_000_000_000))
  })
})

describe("formatBytes", () => {
  it("formats bytes to GiB", () => {
    expect(formatBytes(BigInt(537_137_266_278))).toBe("500.25 GiB")
  })

  it("formats large values to TiB", () => {
    expect(formatBytes(BigInt(1_099_511_627_776))).toBe("1.00 TiB")
  })

  it("formats small values to MiB", () => {
    expect(formatBytes(BigInt(104_857_600))).toBe("100.00 MiB")
  })

  it("formats zero", () => {
    expect(formatBytes(BigInt(0))).toBe("0 B")
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test:run src/lib/parser.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement parser**

Create: `src/lib/parser.ts`

```typescript
// src/lib/parser.ts
//
// Functions: parseBytes, formatBytes

const BINARY_UNITS: Record<string, bigint> = {
  B: BigInt(1),
  KiB: BigInt(1024),
  MiB: BigInt(1024 ** 2),
  GiB: BigInt(1024 ** 3),
  TiB: BigInt(2) ** BigInt(40),
}

const DECIMAL_UNITS: Record<string, bigint> = {
  KB: BigInt(1000),
  MB: BigInt(1000 ** 2),
  GB: BigInt(1000 ** 3),
  TB: BigInt(1000 ** 4),
}

export function parseBytes(formatted: string): bigint {
  const match = formatted.trim().match(/^([\d.]+)\s*([A-Za-z]+)$/)
  if (!match) {
    throw new Error(`Invalid byte format: "${formatted}"`)
  }

  const value = parseFloat(match[1])
  const unit = match[2]

  const binaryMultiplier = BINARY_UNITS[unit]
  if (binaryMultiplier !== undefined) {
    return BigInt(Math.round(value * Number(binaryMultiplier)))
  }

  const decimalMultiplier = DECIMAL_UNITS[unit]
  if (decimalMultiplier !== undefined) {
    return BigInt(Math.round(value * Number(decimalMultiplier)))
  }

  throw new Error(`Unknown unit: "${unit}"`)
}

const FORMAT_THRESHOLDS: Array<{ unit: string; threshold: bigint; divisor: number }> = [
  { unit: "TiB", threshold: BigInt(2) ** BigInt(40), divisor: Number(BigInt(2) ** BigInt(40)) },
  { unit: "GiB", threshold: BigInt(1024 ** 3), divisor: 1024 ** 3 },
  { unit: "MiB", threshold: BigInt(1024 ** 2), divisor: 1024 ** 2 },
  { unit: "KiB", threshold: BigInt(1024), divisor: 1024 },
]

export function formatBytes(bytes: bigint): string {
  if (bytes === BigInt(0)) return "0 B"

  for (const { unit, threshold, divisor } of FORMAT_THRESHOLDS) {
    if (bytes >= threshold) {
      const value = Number(bytes) / divisor
      return `${value.toFixed(2)} ${unit}`
    }
  }

  return `${bytes} B`
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test:run src/lib/parser.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/parser.test.ts
git commit -m "add byte parser for UNIT3D formatted strings"
```

---

### Task 6: Crypto Utilities (TDD)

Encrypt/decrypt API tokens using AES-256-GCM with a key derived from the master password.

**Step 1: Write failing tests**

Create: `src/lib/crypto.test.ts`

```typescript
// src/lib/crypto.test.ts
import { describe, it, expect } from "vitest"
import { deriveKey, encrypt, decrypt } from "./crypto"

describe("deriveKey", () => {
  it("derives a consistent key from password and salt", async () => {
    const salt = "test-salt-value"
    const key1 = await deriveKey("my-password", salt)
    const key2 = await deriveKey("my-password", salt)
    expect(Buffer.from(key1).toString("hex")).toBe(Buffer.from(key2).toString("hex"))
  })

  it("derives different keys for different passwords", async () => {
    const salt = "test-salt-value"
    const key1 = await deriveKey("password-a", salt)
    const key2 = await deriveKey("password-b", salt)
    expect(Buffer.from(key1).toString("hex")).not.toBe(Buffer.from(key2).toString("hex"))
  })
})

describe("encrypt + decrypt", () => {
  it("round-trips a plaintext value", async () => {
    const key = await deriveKey("test-password", "test-salt")
    const plaintext = "my-secret-api-token-12345"
    const encrypted = encrypt(plaintext, key)
    const decrypted = decrypt(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it("produces different ciphertexts for same input (random IV)", async () => {
    const key = await deriveKey("test-password", "test-salt")
    const plaintext = "same-token"
    const a = encrypt(plaintext, key)
    const b = encrypt(plaintext, key)
    expect(a).not.toBe(b)
  })

  it("fails to decrypt with wrong key", async () => {
    const key1 = await deriveKey("password-a", "salt")
    const key2 = await deriveKey("password-b", "salt")
    const encrypted = encrypt("secret", key1)
    expect(() => decrypt(encrypted, key2)).toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test:run src/lib/crypto.test.ts
```

**Step 3: Implement crypto utilities**

Create: `src/lib/crypto.ts`

```typescript
// src/lib/crypto.ts
//
// Functions: deriveKey, encrypt, decrypt, generateSalt
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "crypto"

const KEY_LENGTH = 32 // 256 bits for AES-256
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16

export async function deriveKey(password: string, salt: string): Promise<Buffer> {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  // Format: base64(iv + authTag + ciphertext)
  const combined = Buffer.concat([iv, authTag, encrypted])
  return combined.toString("base64")
}

export function decrypt(encryptedBase64: string, key: Buffer): string {
  const combined = Buffer.from(encryptedBase64, "base64")

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function generateSalt(): string {
  return randomBytes(32).toString("hex")
}
```

**Step 4: Run tests**

```bash
pnpm test:run src/lib/crypto.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/crypto.ts src/lib/crypto.test.ts
git commit -m "add AES-256-GCM crypto utilities with scrypt key derivation"
```

---

### Task 7: Auth System

Session-based auth using signed JWTs in httpOnly cookies.

**Step 1: Install cookie dependency**

```bash
pnpm add cookie
pnpm add -D @types/cookie
```

**Step 2: Create auth helpers**

Create: `src/lib/auth.ts`

```typescript
// src/lib/auth.ts
//
// Functions: hashPassword, verifyPassword, createSession, getSession, clearSession
import argon2 from "argon2"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

const SESSION_COOKIE = "tt_session"
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET not set")
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password)
}

export async function createSession(encryptionKey: string): Promise<string> {
  const token = await new SignJWT({ ek: encryptionKey })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSessionSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })

  return token
}

export async function getSession(): Promise<{ encryptionKey: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    return { encryptionKey: payload.ek as string }
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function requireAuth(): Promise<{ encryptionKey: string }> {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}
```

**Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "add session auth with argon2 password hashing and JWT cookies"
```

---

### Task 8: UNIT3D Adapter (TDD)

**Step 1: Create adapter interface**

Create: `src/lib/adapters/types.ts`

```typescript
// src/lib/adapters/types.ts
export interface TrackerStats {
  username: string
  group: string
  uploadedBytes: bigint
  downloadedBytes: bigint
  ratio: number
  bufferBytes: bigint
  seedingCount: number
  leechingCount: number
  seedbonus: number
  hitAndRuns: number
}

export interface TrackerAdapter {
  fetchStats(baseUrl: string, apiToken: string, apiPath: string): Promise<TrackerStats>
}
```

**Step 2: Write failing tests for UNIT3D adapter**

Create: `src/lib/adapters/unit3d.test.ts`

```typescript
// src/lib/adapters/unit3d.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { Unit3dAdapter } from "./unit3d"

describe("Unit3dAdapter", () => {
  const adapter = new Unit3dAdapter()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses a valid API response into TrackerStats", async () => {
    const mockResponse = {
      username: "JohnDoe",
      group: "Power User",
      uploaded: "500.25 GiB",
      downloaded: "125.50 GiB",
      ratio: "3.99",
      buffer: "374.75 GiB",
      seeding: 156,
      leeching: 2,
      seedbonus: "12500.00",
      hit_and_runs: 0,
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const stats = await adapter.fetchStats("https://aither.cc", "fake-token", "/api/user")

    expect(stats.username).toBe("JohnDoe")
    expect(stats.group).toBe("Power User")
    expect(stats.uploadedBytes).toBe(BigInt(537_137_266_278))
    expect(stats.downloadedBytes).toBe(BigInt(134_793_748_685))
    expect(stats.ratio).toBeCloseTo(3.99)
    expect(stats.seedingCount).toBe(156)
    expect(stats.leechingCount).toBe(2)
    expect(stats.seedbonus).toBe(12500)
    expect(stats.hitAndRuns).toBe(0)
  })

  it("throws on non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response)

    await expect(
      adapter.fetchStats("https://aither.cc", "bad-token", "/api/user")
    ).rejects.toThrow("401")
  })

  it("throws on network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"))

    await expect(
      adapter.fetchStats("https://aither.cc", "token", "/api/user")
    ).rejects.toThrow("Network error")
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
pnpm test:run src/lib/adapters/unit3d.test.ts
```

**Step 4: Implement UNIT3D adapter**

Create: `src/lib/adapters/unit3d.ts`

```typescript
// src/lib/adapters/unit3d.ts
import { parseBytes } from "@/lib/parser"
import type { TrackerAdapter, TrackerStats } from "./types"

interface Unit3dApiResponse {
  username: string
  group: string
  uploaded: string
  downloaded: string
  ratio: string
  buffer: string
  seeding: number
  leeching: number
  seedbonus: string
  hit_and_runs: number
}

export class Unit3dAdapter implements TrackerAdapter {
  async fetchStats(baseUrl: string, apiToken: string, apiPath: string): Promise<TrackerStats> {
    const url = new URL(apiPath, baseUrl)
    url.searchParams.set("api_token", apiToken)

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
    }

    const data: Unit3dApiResponse = await response.json()

    return {
      username: data.username,
      group: data.group,
      uploadedBytes: parseBytes(data.uploaded),
      downloadedBytes: parseBytes(data.downloaded),
      ratio: parseFloat(data.ratio) || 0,
      bufferBytes: parseBytes(data.buffer),
      seedingCount: data.seeding,
      leechingCount: data.leeching,
      seedbonus: parseFloat(data.seedbonus) || 0,
      hitAndRuns: data.hit_and_runs,
    }
  }
}
```

**Step 5: Create adapter registry**

Create: `src/lib/adapters/index.ts`

```typescript
// src/lib/adapters/index.ts
//
// Functions: getAdapter
import type { TrackerAdapter } from "./types"
import { Unit3dAdapter } from "./unit3d"

const adapters: Record<string, TrackerAdapter> = {
  unit3d: new Unit3dAdapter(),
}

export function getAdapter(platformType: string): TrackerAdapter {
  const adapter = adapters[platformType]
  if (!adapter) {
    throw new Error(`Unknown platform type: "${platformType}"`)
  }
  return adapter
}

export type { TrackerAdapter, TrackerStats } from "./types"
```

**Step 6: Run tests**

```bash
pnpm test:run src/lib/adapters/unit3d.test.ts
```

Expected: All PASS.

**Step 7: Commit**

```bash
git add src/lib/adapters/
git commit -m "add UNIT3D adapter with stats parsing and adapter registry"
```

---

### Task 9: Polling Scheduler

**Step 1: Create scheduler**

Create: `src/lib/scheduler.ts`

```typescript
// src/lib/scheduler.ts
//
// Functions: startScheduler, stopScheduler, pollTracker, pollAllTrackers
import cron from "node-cron"
import { db } from "@/lib/db"
import { trackers, trackerSnapshots } from "@/lib/db/schema"
import { getAdapter } from "@/lib/adapters"
import { decrypt, deriveKey } from "@/lib/crypto"
import { eq } from "drizzle-orm"

let schedulerTask: cron.ScheduledTask | null = null

export async function pollTracker(
  trackerId: number,
  encryptionKey: Buffer
): Promise<void> {
  const [tracker] = await db
    .select()
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker || !tracker.isActive) return

  try {
    const apiToken = decrypt(tracker.encryptedApiToken, encryptionKey)
    const adapter = getAdapter(tracker.platformType)
    const stats = await adapter.fetchStats(tracker.baseUrl, apiToken, tracker.apiPath)

    await db.insert(trackerSnapshots).values({
      trackerId: tracker.id,
      polledAt: new Date(),
      uploadedBytes: stats.uploadedBytes,
      downloadedBytes: stats.downloadedBytes,
      ratio: stats.ratio,
      bufferBytes: stats.bufferBytes,
      seedingCount: stats.seedingCount,
      leechingCount: stats.leechingCount,
      seedbonus: stats.seedbonus,
      hitAndRuns: stats.hitAndRuns,
      username: stats.username,
      group: stats.group,
    })

    await db
      .update(trackers)
      .set({ lastPolledAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(trackers.id, tracker.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    await db
      .update(trackers)
      .set({ lastError: message, updatedAt: new Date() })
      .where(eq(trackers.id, trackerId))
    console.error(`Poll failed for tracker ${trackerId}:`, message)
  }
}

export async function pollAllTrackers(encryptionKey: Buffer): Promise<void> {
  const allTrackers = await db
    .select()
    .from(trackers)
    .where(eq(trackers.isActive, true))

  const now = Date.now()

  for (const tracker of allTrackers) {
    const intervalMs = tracker.pollIntervalMinutes * 60 * 1000
    const lastPoll = tracker.lastPolledAt?.getTime() ?? 0

    if (now - lastPoll >= intervalMs) {
      await pollTracker(tracker.id, encryptionKey)
    }
  }
}

export function startScheduler(encryptionKey: Buffer): void {
  if (schedulerTask) return

  // Check every 5 minutes if any tracker needs polling
  schedulerTask = cron.schedule("*/5 * * * *", async () => {
    try {
      await pollAllTrackers(encryptionKey)
    } catch (error) {
      console.error("Scheduler error:", error)
    }
  })

  console.log("Polling scheduler started (checking every 5 minutes)")
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop()
    schedulerTask = null
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "add polling scheduler with per-tracker configurable intervals"
```

---

## Phase 2: API Routes

### Task 10: Auth API Routes

**Step 1: Create setup route (first-run password creation)**

Create: `src/app/api/auth/setup/route.ts`

```typescript
// src/app/api/auth/setup/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"

export async function POST(request: Request) {
  const existing = await db.select().from(appSettings).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  const { password } = await request.json()
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)
  const encryptionSalt = generateSalt()

  await db.insert(appSettings).values({ passwordHash, encryptionSalt })

  return NextResponse.json({ success: true })
}
```

**Step 2: Create login route**

Create: `src/app/api/auth/login/route.ts`

```typescript
// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { verifyPassword, createSession } from "@/lib/auth"
import { deriveKey } from "@/lib/crypto"

export async function POST(request: Request) {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const { password } = await request.json()
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 })
  }

  const valid = await verifyPassword(settings.passwordHash, password)
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  // Derive encryption key and store in session
  const key = await deriveKey(password, settings.encryptionSalt)
  await createSession(key.toString("hex"))

  return NextResponse.json({ success: true })
}
```

**Step 3: Create logout route**

Create: `src/app/api/auth/logout/route.ts`

```typescript
// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth"

export async function POST() {
  await clearSession()
  return NextResponse.json({ success: true })
}
```

**Step 4: Create auth status route**

Create: `src/app/api/auth/status/route.ts`

```typescript
// src/app/api/auth/status/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { getSession } from "@/lib/auth"

export async function GET() {
  const [settings] = await db.select().from(appSettings).limit(1)
  const session = await getSession()

  return NextResponse.json({
    configured: !!settings,
    authenticated: !!session,
  })
}
```

**Step 5: Commit**

```bash
git add src/app/api/auth/
git commit -m "add auth API routes for setup, login, logout, and status"
```

---

### Task 11: Tracker CRUD API Routes

**Step 1: Create trackers list + create route**

Create: `src/app/api/trackers/route.ts`

```typescript
// src/app/api/trackers/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { trackers, trackerSnapshots } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { encrypt, deriveKey } from "@/lib/crypto"
import { appSettings } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export async function GET() {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const allTrackers = await db.select().from(trackers).orderBy(trackers.name)

  // Get latest snapshot for each tracker (for sidebar ratio display)
  const trackersWithStats = await Promise.all(
    allTrackers.map(async (tracker) => {
      const [latest] = await db
        .select()
        .from(trackerSnapshots)
        .where(eq(trackerSnapshots.trackerId, tracker.id))
        .orderBy(desc(trackerSnapshots.polledAt))
        .limit(1)

      return {
        id: tracker.id,
        name: tracker.name,
        baseUrl: tracker.baseUrl,
        platformType: tracker.platformType,
        pollIntervalMinutes: tracker.pollIntervalMinutes,
        isActive: tracker.isActive,
        lastPolledAt: tracker.lastPolledAt,
        lastError: tracker.lastError,
        color: tracker.color,
        latestStats: latest
          ? {
              ratio: latest.ratio,
              uploadedBytes: latest.uploadedBytes?.toString(),
              downloadedBytes: latest.downloadedBytes?.toString(),
              seedingCount: latest.seedingCount,
              leechingCount: latest.leechingCount,
              username: latest.username,
              group: latest.group,
            }
          : null,
      }
    })
  )

  return NextResponse.json(trackersWithStats)
}

export async function POST(request: Request) {
  let session
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, baseUrl, apiToken, platformType, pollIntervalMinutes, color } = body

  if (!name || !baseUrl || !apiToken) {
    return NextResponse.json(
      { error: "name, baseUrl, and apiToken are required" },
      { status: 400 }
    )
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  const key = Buffer.from(session.encryptionKey, "hex")
  const encryptedApiToken = encrypt(apiToken, key)

  const [tracker] = await db
    .insert(trackers)
    .values({
      name,
      baseUrl,
      encryptedApiToken,
      platformType: platformType || "unit3d",
      pollIntervalMinutes: pollIntervalMinutes || 360,
      color: color || "#00d4ff",
    })
    .returning()

  return NextResponse.json({ id: tracker.id, name: tracker.name }, { status: 201 })
}
```

**Step 2: Create individual tracker route (get, update, delete)**

Create: `src/app/api/trackers/[id]/route.ts`

```typescript
// src/app/api/trackers/[id]/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"
import { eq } from "drizzle-orm"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (body.name) updates.name = body.name
  if (body.baseUrl) updates.baseUrl = body.baseUrl
  if (body.pollIntervalMinutes) updates.pollIntervalMinutes = body.pollIntervalMinutes
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.color) updates.color = body.color

  if (body.apiToken) {
    const key = Buffer.from(session.encryptionKey, "hex")
    updates.encryptedApiToken = encrypt(body.apiToken, key)
  }

  await db
    .update(trackers)
    .set(updates)
    .where(eq(trackers.id, parseInt(id)))

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  await db.delete(trackers).where(eq(trackers.id, parseInt(id)))

  return NextResponse.json({ success: true })
}
```

**Step 3: Commit**

```bash
git add src/app/api/trackers/
git commit -m "add tracker CRUD API routes with encrypted token storage"
```

---

### Task 12: Snapshot + Poll API Routes

**Step 1: Create snapshot query route**

Create: `src/app/api/trackers/[id]/snapshots/route.ts`

```typescript
// src/app/api/trackers/[id]/snapshots/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { trackerSnapshots } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, and, gte, desc } from "drizzle-orm"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get("days") || "30")
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const snapshots = await db
    .select()
    .from(trackerSnapshots)
    .where(
      and(
        eq(trackerSnapshots.trackerId, parseInt(id)),
        gte(trackerSnapshots.polledAt, since)
      )
    )
    .orderBy(trackerSnapshots.polledAt)

  // Serialize bigints to strings for JSON
  const serialized = snapshots.map((s) => ({
    ...s,
    uploadedBytes: s.uploadedBytes?.toString(),
    downloadedBytes: s.downloadedBytes?.toString(),
    bufferBytes: s.bufferBytes?.toString(),
  }))

  return NextResponse.json(serialized)
}
```

**Step 2: Create manual poll trigger route**

Create: `src/app/api/trackers/[id]/poll/route.ts`

```typescript
// src/app/api/trackers/[id]/poll/route.ts
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { pollTracker } from "@/lib/scheduler"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const key = Buffer.from(session.encryptionKey, "hex")

  try {
    await pollTracker(parseInt(id), key)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/trackers/
git commit -m "add snapshot query and manual poll trigger API routes"
```

---

## Phase 3: UI Components

### Task 13: Base UI Component Library

Build reusable primitives with the command-center aesthetic.

**Step 1: Create Button component**

Create: `src/components/ui/Button.tsx`

```tsx
// src/components/ui/Button.tsx
import { type ButtonHTMLAttributes, forwardRef } from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 hover:border-accent/50 hover:shadow-glow-sm active:bg-accent/25",
  secondary:
    "bg-raised text-secondary border border-border hover:text-primary hover:border-border-emphasis active:bg-elevated",
  ghost:
    "text-secondary hover:text-primary hover:bg-raised active:bg-elevated",
  danger:
    "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 hover:border-danger/50 active:bg-danger/25",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2
          rounded font-medium
          transition-all duration-150 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus
          disabled:opacity-40 disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        disabled={disabled}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
```

**Step 2: Create Input component**

Create: `src/components/ui/Input.tsx`

```tsx
// src/components/ui/Input.tsx
import { type InputHTMLAttributes, forwardRef } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded bg-control-bg border border-control-border
            px-3 py-2 text-sm text-primary font-mono
            placeholder:text-muted
            transition-all duration-150
            focus:outline-none focus:border-control-focus focus:ring-1 focus:ring-control-focus
            disabled:opacity-40
            ${error ? "border-danger focus:border-danger focus:ring-danger/50" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }
)

Input.displayName = "Input"
```

**Step 3: Create Card component**

Create: `src/components/ui/Card.tsx`

```tsx
// src/components/ui/Card.tsx
import { type HTMLAttributes, forwardRef } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: "raised" | "elevated"
  glow?: boolean
  glowColor?: string
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ elevation = "raised", glow = false, glowColor, className = "", style, ...props }, ref) => {
    const bgClass = elevation === "raised" ? "bg-raised" : "bg-elevated"
    const glowStyle = glow
      ? { boxShadow: `0 0 12px ${glowColor || "var(--accent-glow)"}` }
      : undefined

    return (
      <div
        ref={ref}
        className={`
          ${bgClass} rounded-md border border-border
          transition-all duration-200
          ${className}
        `}
        style={{ ...glowStyle, ...style }}
        {...props}
      />
    )
  }
)

Card.displayName = "Card"
```

**Step 4: Create PulseDot component**

Create: `src/components/ui/PulseDot.tsx`

```tsx
// src/components/ui/PulseDot.tsx

type PulseStatus = "healthy" | "warning" | "critical" | "error" | "offline"

interface PulseDotProps {
  status: PulseStatus
  size?: "sm" | "md"
}

const statusColors: Record<PulseStatus, { dot: string; glow: string }> = {
  healthy: { dot: "bg-accent", glow: "text-accent" },
  warning: { dot: "bg-warn", glow: "text-warn" },
  critical: { dot: "bg-danger", glow: "text-danger" },
  error: { dot: "bg-tertiary", glow: "text-tertiary" },
  offline: { dot: "bg-muted", glow: "text-muted" },
}

const sizeClasses: Record<string, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
}

export function PulseDot({ status, size = "sm" }: PulseDotProps) {
  const colors = statusColors[status]
  const animate = status !== "offline" && status !== "error"

  return (
    <span
      className={`
        inline-block rounded-full
        ${sizeClasses[size]}
        ${colors.dot}
        ${animate ? `animate-pulse-glow ${colors.glow}` : ""}
      `}
      aria-label={status}
    />
  )
}
```

**Step 5: Create Badge component**

Create: `src/components/ui/Badge.tsx`

```tsx
// src/components/ui/Badge.tsx

type BadgeVariant = "default" | "accent" | "warn" | "danger" | "success"

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-elevated text-secondary border-border",
  accent: "bg-accent/10 text-accent border-accent/20",
  warn: "bg-warn/10 text-warn border-warn/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  success: "bg-success/10 text-success border-success/20",
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        text-xs font-medium font-mono
        rounded border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
```

**Step 6: Create StatCard component (for dashboard metrics)**

Create: `src/components/ui/StatCard.tsx`

```tsx
// src/components/ui/StatCard.tsx
import { Card } from "./Card"

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  trend?: "up" | "down" | "flat"
  trendValue?: string
}

export function StatCard({ label, value, subValue, trend, trendValue }: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-success" : trend === "down" ? "text-danger" : "text-tertiary"

  return (
    <Card className="p-4">
      <div className="text-xs text-tertiary font-medium uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-2xl font-mono font-semibold text-primary tracking-tight">
        {value}
      </div>
      {(subValue || trendValue) && (
        <div className="flex items-center gap-2 mt-1">
          {subValue && <span className="text-xs text-secondary">{subValue}</span>}
          {trendValue && (
            <span className={`text-xs font-mono ${trendColor}`}>
              {trend === "up" ? "+" : trend === "down" ? "-" : ""}
              {trendValue}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
```

**Step 7: Create component barrel export**

Create: `src/components/ui/index.ts`

```typescript
// src/components/ui/index.ts
export { Button } from "./Button"
export { Input } from "./Input"
export { Card } from "./Card"
export { PulseDot } from "./PulseDot"
export { Badge } from "./Badge"
export { StatCard } from "./StatCard"
```

**Step 8: Commit**

```bash
git add src/components/ui/
git commit -m "add base UI component library with glow theme"
```

---

### Task 14: App Layout (Sidebar + Content)

**Step 1: Create Sidebar component**

Create: `src/components/layout/Sidebar.tsx`

```tsx
// src/components/layout/Sidebar.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { PulseDot } from "@/components/ui"

interface TrackerSummary {
  id: number
  name: string
  isActive: boolean
  lastError: string | null
  color: string
  latestStats: {
    ratio: number | null
    username: string | null
  } | null
}

function getRatioStatus(ratio: number | null, hasError: boolean): "healthy" | "warning" | "critical" | "error" | "offline" {
  if (hasError) return "error"
  if (ratio === null) return "offline"
  if (ratio >= 2) return "healthy"
  if (ratio >= 1) return "warning"
  return "critical"
}

export function Sidebar() {
  const [trackers, setTrackers] = useState<TrackerSummary[]>([])
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/trackers")
      if (res.ok) {
        setTrackers(await res.json())
      }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  const activeId = pathname.match(/\/tracker\/(\d+)/)?.[1]

  return (
    <aside className="w-64 h-screen border-r border-border flex flex-col bg-base">
      <div className="p-4 border-b border-border">
        <h1 className="text-sm font-semibold text-primary tracking-wide uppercase">
          Tracker Tracker
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold text-tertiary uppercase tracking-widest">
            Trackers
          </span>
        </div>

        {trackers.map((tracker) => {
          const isActive = activeId === String(tracker.id)
          const status = getRatioStatus(
            tracker.latestStats?.ratio ?? null,
            !!tracker.lastError
          )
          const ratio = tracker.latestStats?.ratio

          return (
            <button
              key={tracker.id}
              onClick={() => router.push(`/tracker/${tracker.id}`)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded
                text-left text-sm transition-all duration-150
                ${
                  isActive
                    ? "bg-accent/10 text-primary border border-accent/20"
                    : "text-secondary hover:text-primary hover:bg-raised border border-transparent"
                }
              `}
            >
              <PulseDot status={status} />
              <span className="flex-1 truncate">{tracker.name}</span>
              <span className="font-mono text-xs text-tertiary tabular-nums">
                {ratio !== null && ratio !== undefined
                  ? ratio.toFixed(2)
                  : tracker.lastError
                    ? "err"
                    : "—"}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={() => router.push("/tracker/add")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded
            text-xs text-accent border border-accent/20 bg-accent/5
            hover:bg-accent/10 hover:border-accent/30 transition-all"
        >
          + Add Tracker
        </button>
      </div>
    </aside>
  )
}
```

**Step 2: Create auth-protected layout**

Create: `src/app/(auth)/layout.tsx`

```tsx
// src/app/(auth)/layout.tsx
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { Sidebar } from "@/components/layout/Sidebar"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    redirect("/setup")
  }

  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
```

**Step 3: Create dashboard overview placeholder**

Create: `src/app/(auth)/page.tsx`

```tsx
// src/app/(auth)/page.tsx
export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-secondary text-sm">
          Select a tracker from the sidebar to view stats
        </p>
      </div>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/layout/ src/app/\(auth\)/
git commit -m "add sidebar layout with tracker list and auth-protected routes"
```

---

### Task 15: Login + Setup Pages

**Step 1: Create setup page (first-run)**

Create: `src/app/setup/page.tsx`

```tsx
// src/app/setup/page.tsx
"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Card } from "@/components/ui"

export default function SetupPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    const setupRes = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (!setupRes.ok) {
      const data = await setupRes.json()
      setError(data.error || "Setup failed")
      setLoading(false)
      return
    }

    const loginRes = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (loginRes.ok) {
      router.push("/")
    } else {
      setError("Setup succeeded but login failed. Try logging in.")
      router.push("/login")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-primary mb-1">Tracker Tracker</h1>
        <p className="text-xs text-tertiary mb-6">
          Set a master password. This encrypts your API tokens at rest.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Master Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            autoFocus
          />
          <Input
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
          />

          {error && <p className="text-xs text-danger">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Setting up..." : "Initialize"}
          </Button>
        </form>
      </Card>
    </div>
  )
}
```

**Step 2: Create login page**

Create: `src/app/login/page.tsx`

```tsx
// src/app/login/page.tsx
"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Card } from "@/components/ui"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push("/")
    } else {
      const data = await res.json()
      setError(data.error || "Login failed")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold text-primary mb-1">Tracker Tracker</h1>
        <p className="text-xs text-tertiary mb-6">Enter your master password to unlock.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master password"
            autoFocus
          />

          {error && <p className="text-xs text-danger">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? "Unlocking..." : "Unlock"}
          </Button>
        </form>
      </Card>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/setup/ src/app/login/
git commit -m "add setup and login pages with master password flow"
```

---

### Task 16: Add Tracker Page

**Step 1: Create add tracker page with pre-configured options**

Create: `src/app/(auth)/tracker/add/page.tsx`

```tsx
// src/app/(auth)/tracker/add/page.tsx
"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Card } from "@/components/ui"

const PRESETS = [
  { name: "Aither", baseUrl: "https://aither.cc" },
  { name: "OnlyEncodes", baseUrl: "https://onlyencodes.cc" },
  { name: "FearNoPeer", baseUrl: "https://fearnopeer.com" },
  { name: "Blutopia", baseUrl: "https://blutopia.cc" },
] as const

export default function AddTrackerPage() {
  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [pollInterval, setPollInterval] = useState("360")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function selectPreset(preset: (typeof PRESETS)[number]) {
    setName(preset.name)
    setBaseUrl(preset.baseUrl)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")

    if (!name || !baseUrl || !apiToken) {
      setError("All fields are required")
      return
    }

    setLoading(true)

    const res = await fetch("/api/trackers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        baseUrl,
        apiToken,
        pollIntervalMinutes: parseInt(pollInterval),
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/tracker/${data.id}`)
    } else {
      const data = await res.json()
      setError(data.error || "Failed to add tracker")
    }

    setLoading(false)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold text-primary mb-4">Add Tracker</h2>

      <div className="flex gap-2 mb-6">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => selectPreset(preset)}
            className={`
              px-3 py-1.5 rounded text-xs border transition-all
              ${
                name === preset.name
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border text-tertiary hover:text-secondary hover:border-border-emphasis"
              }
            `}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Tracker Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Aither"
          />
          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://aither.cc"
          />
          <Input
            label="API Token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Your UNIT3D API token"
          />
          <div>
            <label className="text-xs font-medium text-secondary mb-1 block">
              Poll Interval
            </label>
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(e.target.value)}
              className="w-full rounded bg-control-bg border border-control-border
                px-3 py-2 text-sm text-primary font-mono
                focus:outline-none focus:border-control-focus focus:ring-1 focus:ring-control-focus"
            >
              <option value="60">Every hour</option>
              <option value="180">Every 3 hours</option>
              <option value="360">Every 6 hours</option>
              <option value="720">Every 12 hours</option>
              <option value="1440">Every 24 hours</option>
            </select>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Tracker"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(auth\)/tracker/add/
git commit -m "add tracker creation page with UNIT3D presets"
```

---

## Phase 4: Tracker Detail + Charts

### Task 17: ECharts Upload/Download Time-Series Chart

**Step 1: Create ECharts wrapper with glow theme**

Create: `src/components/charts/UploadDownloadChart.tsx`

```tsx
// src/components/charts/UploadDownloadChart.tsx
"use client"

import { useMemo } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"

interface Snapshot {
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
}

interface UploadDownloadChartProps {
  snapshots: Snapshot[]
  height?: number
}

function bytesToGiB(bytes: string): number {
  return Number(BigInt(bytes)) / (1024 ** 3)
}

export function UploadDownloadChart({ snapshots, height = 400 }: UploadDownloadChartProps) {
  const option: EChartsOption = useMemo(() => {
    const dates = snapshots.map((s) => new Date(s.polledAt).toLocaleDateString())
    const uploaded = snapshots.map((s) => bytesToGiB(s.uploadedBytes).toFixed(2))
    const downloaded = snapshots.map((s) => bytesToGiB(s.downloadedBytes).toFixed(2))

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#151b30",
        borderColor: "rgba(0, 212, 255, 0.2)",
        textStyle: { color: "#e2e8f0", fontFamily: "var(--font-mono)", fontSize: 12 },
        formatter: (params: any) => {
          const date = params[0]?.axisValue
          const lines = params.map((p: any) =>
            `<span style="color:${p.color}">${p.seriesName}</span>: ${p.value} GiB`
          )
          return `${date}<br/>${lines.join("<br/>")}`
        },
      },
      legend: {
        data: ["Uploaded", "Downloaded"],
        textStyle: { color: "#64748b", fontFamily: "var(--font-mono)", fontSize: 11 },
        top: 0,
      },
      grid: {
        top: 40,
        right: 20,
        bottom: 40,
        left: 60,
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.12)" } },
        axisLabel: { color: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" },
      },
      yAxis: {
        type: "value",
        name: "GiB",
        nameTextStyle: { color: "#64748b", fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.06)" } },
        axisLabel: { color: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" },
      },
      series: [
        {
          name: "Uploaded",
          type: "line",
          data: uploaded,
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: {
            color: "#00d4ff",
            width: 2,
            shadowColor: "rgba(0, 212, 255, 0.4)",
            shadowBlur: 8,
          },
          itemStyle: { color: "#00d4ff" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(0, 212, 255, 0.15)" },
                { offset: 1, color: "rgba(0, 212, 255, 0)" },
              ],
            },
          },
        },
        {
          name: "Downloaded",
          type: "line",
          data: downloaded,
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: {
            color: "#f59e0b",
            width: 2,
            shadowColor: "rgba(245, 158, 11, 0.3)",
            shadowBlur: 6,
          },
          itemStyle: { color: "#f59e0b" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(245, 158, 11, 0.1)" },
                { offset: 1, color: "rgba(245, 158, 11, 0)" },
              ],
            },
          },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          type: "slider",
          start: 0,
          end: 100,
          height: 20,
          bottom: 5,
          borderColor: "rgba(148, 163, 184, 0.12)",
          backgroundColor: "#0f1424",
          fillerColor: "rgba(0, 212, 255, 0.08)",
          handleStyle: { color: "#00d4ff", borderColor: "#00d4ff" },
          textStyle: { color: "#64748b", fontSize: 10 },
        },
      ],
    }
  }, [snapshots])

  if (snapshots.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-border rounded-md bg-raised"
        style={{ height }}
      >
        <p className="text-sm text-tertiary">No snapshot data yet. Waiting for first poll...</p>
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      opts={{ renderer: "canvas" }}
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/components/charts/
git commit -m "add ECharts upload/download time-series chart with glow theme"
```

---

### Task 18: Tracker Detail Page

**Step 1: Create tracker detail page**

Create: `src/app/(auth)/tracker/[id]/page.tsx`

```tsx
// src/app/(auth)/tracker/[id]/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { StatCard, Card, Badge, Button } from "@/components/ui"
import { UploadDownloadChart } from "@/components/charts/UploadDownloadChart"

interface TrackerDetail {
  id: number
  name: string
  baseUrl: string
  platformType: string
  pollIntervalMinutes: number
  isActive: boolean
  lastPolledAt: string | null
  lastError: string | null
  color: string
  latestStats: {
    ratio: number | null
    uploadedBytes: string | null
    downloadedBytes: string | null
    seedingCount: number | null
    leechingCount: number | null
    username: string | null
    group: string | null
  } | null
}

interface Snapshot {
  polledAt: string
  uploadedBytes: string
  downloadedBytes: string
  ratio: number | null
  seedbonus: number | null
  seedingCount: number | null
  leechingCount: number | null
  hitAndRuns: number | null
  bufferBytes: string
}

function formatGiB(bytesStr: string | null): string {
  if (!bytesStr) return "—"
  const gib = Number(BigInt(bytesStr)) / (1024 ** 3)
  if (gib >= 1024) return `${(gib / 1024).toFixed(2)} TiB`
  return `${gib.toFixed(2)} GiB`
}

export default function TrackerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tracker, setTracker] = useState<TrackerDetail | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [days, setDays] = useState(30)
  const [polling, setPolling] = useState(false)

  const loadData = useCallback(async () => {
    const [trackerRes, snapshotRes] = await Promise.all([
      fetch("/api/trackers"),
      fetch(`/api/trackers/${id}/snapshots?days=${days}`),
    ])

    if (trackerRes.ok) {
      const all = await trackerRes.json()
      setTracker(all.find((t: TrackerDetail) => t.id === parseInt(id)))
    }
    if (snapshotRes.ok) {
      setSnapshots(await snapshotRes.json())
    }
  }, [id, days])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handlePollNow() {
    setPolling(true)
    await fetch(`/api/trackers/${id}/poll`, { method: "POST" })
    await loadData()
    setPolling(false)
  }

  if (!tracker) {
    return <div className="text-secondary text-sm">Loading...</div>
  }

  const stats = tracker.latestStats
  const latest = snapshots[snapshots.length - 1]

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-primary">{tracker.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            {stats?.username && (
              <span className="text-sm text-secondary">{stats.username}</span>
            )}
            {stats?.group && <Badge variant="accent">{stats.group}</Badge>}
            <Badge>{tracker.platformType.toUpperCase()}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={handlePollNow} disabled={polling}>
            {polling ? "Polling..." : "Poll Now"}
          </Button>
        </div>
      </div>

      {tracker.lastError && (
        <Card className="p-3 border-danger/30 bg-danger/5">
          <p className="text-xs text-danger font-mono">{tracker.lastError}</p>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Uploaded"
          value={formatGiB(stats?.uploadedBytes ?? null)}
        />
        <StatCard
          label="Downloaded"
          value={formatGiB(stats?.downloadedBytes ?? null)}
        />
        <StatCard
          label="Ratio"
          value={stats?.ratio?.toFixed(2) ?? "—"}
        />
        <StatCard
          label="Buffer"
          value={latest ? formatGiB(latest.bufferBytes) : "—"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Seeding" value={String(stats?.seedingCount ?? "—")} />
        <StatCard label="Leeching" value={String(stats?.leechingCount ?? "—")} />
        <StatCard label="Seedbonus" value={latest?.seedbonus?.toFixed(0) ?? "—"} />
        <StatCard label="Hit & Runs" value={String(latest?.hitAndRuns ?? "—")} />
      </div>

      {/* Chart */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-secondary">Upload / Download Over Time</h3>
          <div className="flex gap-1">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-1 text-xs rounded transition-all ${
                  days === d
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-tertiary hover:text-secondary"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <UploadDownloadChart snapshots={snapshots} />
      </Card>

      {/* Last polled info */}
      <p className="text-xs text-muted">
        Last polled:{" "}
        {tracker.lastPolledAt
          ? new Date(tracker.lastPolledAt).toLocaleString()
          : "Never"}
        {" · "}Polling every {tracker.pollIntervalMinutes / 60}h
      </p>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(auth\)/tracker/\[id\]/
git commit -m "add tracker detail page with stats cards and time-series chart"
```

---

### Task 19: Root Page Redirect

**Step 1: Update root page to redirect**

Replace: `src/app/page.tsx`

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { getSession } from "@/lib/auth"

export default async function RootPage() {
  const [settings] = await db.select().from(appSettings).limit(1)

  if (!settings) {
    redirect("/setup")
  }

  const session = await getSession()
  if (!session) {
    redirect("/login")
  }

  // If authenticated, redirect to the auth-protected dashboard
  redirect("/")
}
```

Note: The `(auth)/page.tsx` serves as the actual dashboard. The root `page.tsx` handles the initial redirect logic. If there's a conflict, the `(auth)` route group takes precedence for authenticated users.

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "add root page redirect for auth flow"
```

---

### Task 20: Tracker Roles Management

**Step 1: Create roles API route**

Create: `src/app/api/trackers/[id]/roles/route.ts`

```typescript
// src/app/api/trackers/[id]/roles/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { trackerRoles } from "@/lib/db/schema"
import { requireAuth } from "@/lib/auth"
import { eq, desc } from "drizzle-orm"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const roles = await db
    .select()
    .from(trackerRoles)
    .where(eq(trackerRoles.trackerId, parseInt(id)))
    .orderBy(desc(trackerRoles.achievedAt))

  return NextResponse.json(roles)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { roleName, achievedAt, notes } = await request.json()

  if (!roleName) {
    return NextResponse.json({ error: "roleName is required" }, { status: 400 })
  }

  const [role] = await db
    .insert(trackerRoles)
    .values({
      trackerId: parseInt(id),
      roleName,
      achievedAt: achievedAt ? new Date(achievedAt) : new Date(),
      notes: notes || null,
    })
    .returning()

  return NextResponse.json(role, { status: 201 })
}
```

**Step 2: Commit**

```bash
git add src/app/api/trackers/\[id\]/roles/
git commit -m "add tracker roles CRUD API route"
```

---

## Phase 5: Final Integration

### Task 21: Next.js Middleware for Auth Protection

**Step 1: Create middleware**

Create: `src/middleware.ts`

```typescript
// src/middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const session = request.cookies.get("tt_session")
  if (!session && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!session && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "add auth middleware for route protection"
```

---

### Task 22: Smoke Test the Full Stack

**Step 1: Verify the dev environment starts**

```bash
docker compose up -d
pnpm db:push
pnpm dev
```

**Step 2: Manual verification checklist**

1. Visit `http://localhost:3000` → redirected to `/setup`
2. Set a master password → redirected to dashboard
3. Click "Add Tracker" → add a test tracker (or use a real Aither token)
4. Click "Poll Now" → snapshot is recorded
5. View the time-series chart with data
6. Sidebar shows tracker with ratio and pulse dot
7. Logout and login flow works

**Step 3: Final commit**

```bash
git add -A
git commit -m "complete initial tracker-tracker implementation"
```

---

## Summary

| Phase | Tasks | What It Builds |
|-------|-------|----------------|
| 1: Foundation | Tasks 1–9 | Scaffold, DB, crypto, auth, adapter, scheduler |
| 2: API Routes | Tasks 10–12 | Auth, tracker CRUD, snapshot queries, poll triggers |
| 3: UI Components | Tasks 13–16 | Component library, layout, login/setup, add tracker |
| 4: Detail + Charts | Tasks 17–20 | ECharts graphs, tracker detail page, roles |
| 5: Integration | Tasks 21–22 | Middleware, smoke test |

**Total: 22 tasks, ~60 commits**

### Future Enhancements (not in this plan)
- Prowlarr integration
- Gazelle adapter
- Dashboard overview with aggregate stats across all trackers
- Export data as CSV
- Docker image for the app itself
- Ratio delta calculations (how much uploaded since last poll)
- Notification system (ratio dropping below threshold)
