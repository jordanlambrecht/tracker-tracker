// src/test/server-only-mock.ts
// Vitest alias for the "server-only" Next.js package.
// The real package throws at import time in non-server environments;
// this stub is a no-op so server-only modules can be tested in Vitest.
export {}
