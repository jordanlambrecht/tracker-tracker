// next.config.ts
import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

if (process.env.BASE_URL) {
  try {
    const parsed = new URL(process.env.BASE_URL)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.error(`BASE_URL must use http or https protocol, got: ${parsed.protocol}`)
      process.exit(1)
    }
  } catch {
    console.error(`BASE_URL is not a valid URL: ${process.env.BASE_URL}`)
    process.exit(1)
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  // Do NOT add "postgres" here to make scripts/recover.cjs work. That was tried
  // and measured against a real build of the production image, and it does not
  // do what it looks like it does:
  //
  //   - postgres.js is `"type": "module"` with its CommonJS build at
  //     cjs/src/index.js. Marking it external makes the tracer copy only the
  //     ESM files the server bundle actually imported, so the traced package in
  //     the image has src/ and no cjs/ at all.
  //   - The tracer also emits no top-level node_modules/postgres symlink for a
  //     config-listed package the way it does for builtin externals like argon2,
  //     so a bare require("postgres") cannot even find the package, and after
  //     hand-linking it, require() resolves to the missing cjs/ build and fails.
  //
  // The CLI gets a complete, self-contained copy of postgres.js copied straight
  // into /app/node_modules by the Dockerfile instead. That leaves the server's
  // own database driver exactly where it is, bundled, so the recovery tooling
  // carries no risk of changing how production loads Postgres.
  serverExternalPackages: ["argon2"],
  // next/dist/server/require-hook.js pulls @swc/helpers/esm/* at runtime, which
  // static tracing cannot see, so standalone ships only the package's cjs/
  // directory and the server dies on boot with MODULE_NOT_FOUND. Force the
  // whole package in. The glob targets pnpm's store layout, where the copy that
  // matters sits behind a symlink the tracer resolves but does not fully walk.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**"],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
  },
  allowedDevOrigins: ["*.local", "*.lan", "192.168.*.*", "10.*.*.*"],
  devIndicators: {
    position: "bottom-right",
  },
  logging: {
    fetches: {
      fullUrl: false,
      hmrRefreshes: false,
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
