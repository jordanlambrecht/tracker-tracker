// src/lib/__tests__/notification-decrypt.test.ts
//
// Functions: decryptNotificationConfig (real crypto round-trip tests)
//
// Why real crypto instead of mocks: decryptNotificationConfig is a thin wrapper
// around decrypt() + JSON.parse(). The bugs worth catching here live at the
// intersection of those two operations — format changes, key mismatches, and
// the error-message shape. Mocking decrypt() would skip all of that.

import { randomBytes, scryptSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { encrypt } from "@/lib/crypto"

// ---------------------------------------------------------------------------
// Key factory — mimics how the app derives encryption keys (scrypt, 32 bytes).
// Using a fast N so tests run in milliseconds, not seconds.
// ---------------------------------------------------------------------------
function makeKey(password = "test-password", salt?: string): Buffer {
  const s = salt ?? randomBytes(16).toString("hex")
  return scryptSync(password, s, 32, { N: 1024, r: 8, p: 1 }) as Buffer
}

// ---------------------------------------------------------------------------
// Import the module under test AFTER the "server-only" alias is resolved by
// vitest.config.ts (points to src/test/server-only-mock.ts), so the import
// guard does not throw in the test environment.
// ---------------------------------------------------------------------------

describe("decryptNotificationConfig", () => {
  it("decrypts a real encrypted config object and returns the parsed shape", async () => {
    // This catches: JSON.parse step breaking, encrypt format changing, or
    // the returned value being a raw string instead of a parsed object.
    const { decryptNotificationConfig } = await import("@/lib/notifications/decrypt")
    const key = makeKey()
    const config = { webhookUrl: "https://discord.com/api/webhooks/111/aaa" }
    const encryptedConfig = encrypt(JSON.stringify(config), key)

    const result = decryptNotificationConfig({ name: "My Webhook", encryptedConfig }, key)

    expect(result).toEqual(config)
    expect(typeof result).toBe("object")
    expect((result as { webhookUrl: string }).webhookUrl).toBe(config.webhookUrl)
  })

  it("throws with the target name in the error message on bad ciphertext", async () => {
    // This catches: error messages leaking raw crypto internals instead of a
    // user-readable message that identifies which target is broken.
    const { decryptNotificationConfig } = await import("@/lib/notifications/decrypt")
    const key = makeKey()
    const targetName = "Production Alerts"

    expect(() =>
      decryptNotificationConfig({ name: targetName, encryptedConfig: "not-valid-base64!!!" }, key)
    ).toThrowError(new RegExp(targetName))
  })

  it("does not surface raw crypto error details in the thrown message", async () => {
    // This catches: a future refactor that accidentally re-throws the raw error
    // (which can contain internal crypto state strings).
    const { decryptNotificationConfig } = await import("@/lib/notifications/decrypt")
    const key = makeKey()

    let thrownMessage = ""
    try {
      decryptNotificationConfig({ name: "Target", encryptedConfig: "bm90dmFsaWQ=" }, key)
    } catch (e) {
      thrownMessage = (e as Error).message
    }

    // The wrapper message must not leak GCM-specific crypto error strings
    expect(thrownMessage).not.toMatch(/Unsupported state/)
    expect(thrownMessage).not.toMatch(/auth tag/)
    expect(thrownMessage).not.toMatch(/Invalid ciphertext/)
    // It must contain the human-readable wrapper text
    expect(thrownMessage).toContain("Config is missing or invalid")
  })

  it("throws when decrypting with the wrong key (GCM auth tag mismatch)", async () => {
    // This catches: key rotation bugs that silently return garbage plaintext
    // instead of failing. AES-256-GCM authentication must reject wrong keys.
    const { decryptNotificationConfig } = await import("@/lib/notifications/decrypt")
    const keyA = makeKey("password-a")
    const keyB = makeKey("password-b")

    const encryptedConfig = encrypt(
      JSON.stringify({ webhookUrl: "https://discord.com/api/webhooks/1/x" }),
      keyA
    )

    expect(() => decryptNotificationConfig({ name: "Target", encryptedConfig }, keyB)).toThrow()
  })

  it("throws on empty encryptedConfig string", async () => {
    // This catches: null/empty config slipping through without an error,
    // which would cause a silent no-op instead of a visible failure.
    const { decryptNotificationConfig } = await import("@/lib/notifications/decrypt")
    const key = makeKey()

    expect(() =>
      decryptNotificationConfig({ name: "Empty Target", encryptedConfig: "" }, key)
    ).toThrow()
  })

  it("round-trips a config with unicode characters intact", async () => {
    // This catches: encoding bugs where multi-byte UTF-8 characters get
    // corrupted during the encrypt → decrypt → JSON.parse pipeline.
    const { decryptNotificationConfig } = await import("@/lib/notifications/decrypt")
    const key = makeKey()
    const config = {
      webhookUrl: "https://discord.com/api/webhooks/1/token",
      note: "日本語テスト 🎉",
    }
    const encryptedConfig = encrypt(JSON.stringify(config), key)

    const result = decryptNotificationConfig({ name: "Unicode Target", encryptedConfig }, key)

    expect(result).toEqual(config)
  })
})
