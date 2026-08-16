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
  serverExternalPackages: ["argon2"],
  // next/dist/server/require-hook.js pulls @swc/helpers/esm/* at runtime, which
  // static tracing cannot see — so standalone ships only the package's cjs/
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
