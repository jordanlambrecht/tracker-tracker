// src/test/setup.ts
import "@testing-library/jest-dom/vitest"

// Prevent pino from trying to write to /data/logs/ during tests
process.env.LOG_FILE = ""
