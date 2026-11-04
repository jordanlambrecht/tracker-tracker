// next.config.ts
import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
  // "postgres" stays off this list so the server keeps its own database driver
  // bundled, and the recovery tooling can't change how production loads
  // Postgres. The CLI gets a complete, self-contained copy of postgres.js that
  // the Dockerfile copies into /app/node_modules instead.
  //
  // Listing it would not have helped scripts/recover.cjs either. On a real build
  // of the production image with postgres.js 3, not re-run since 4, the tracer
  // emitted no top-level node_modules/postgres symlink for a config-listed
  // package the way it does for builtin externals like argon2, so a bare
  // require("postgres") could not find the package.
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
