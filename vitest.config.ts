// vitest.config.ts
import { resolve } from "node:path"
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
      "@icons": resolve(__dirname, "./src/components/ui/Icons"),
      "@typography": resolve(__dirname, "./src/components/ui/Typography"),
      "server-only": resolve(__dirname, "./src/test/server-only-mock.ts"),
    },
  },
})
