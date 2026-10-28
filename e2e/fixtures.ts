// e2e/fixtures.ts
//
// Test-only values. The account exists only in the throwaway e2e database that
// global.setup.ts recreates on every run.
export const E2E_OWNER = {
  username: "e2e-owner",
  password: "e2e-master-password",
}

/** A registry entry whose credential form is a single API token. */
export const E2E_TRACKER = {
  slug: "aither",
  token: "e2e-not-a-real-token",
}
