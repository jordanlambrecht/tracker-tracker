// src/lib/__tests__/notification-type-guards.test.ts

import { describe, expect, it } from "vitest"
import { isDiscordConfig, isNotificationConfig } from "@/lib/notifications/types"
import type {
  DiscordConfig,
  EmailConfig,
  GotifyConfig,
  NotificationConfig,
  SlackConfig,
  TelegramConfig,
} from "@/lib/notifications/types"

// ─── isDiscordConfig ──────────────────────────────────────────────────────────

describe("isDiscordConfig", () => {
  it("returns true for a valid DiscordConfig", () => {
    const config: NotificationConfig = { webhookUrl: "https://discord.com/api/webhooks/123/abc" }
    expect(isDiscordConfig(config)).toBe(true)
  })

  it("returns true for a SlackConfig because both share the webhookUrl shape", () => {
    // This is the documented limitation — callers must additionally check target.type
    const config: NotificationConfig = { webhookUrl: "https://hooks.slack.com/services/T/B/X" }
    expect(isDiscordConfig(config)).toBe(true)
  })

  it("returns false for GotifyConfig (no webhookUrl field)", () => {
    const config: NotificationConfig = { serverUrl: "https://gotify.example.com", appToken: "tok" }
    expect(isDiscordConfig(config)).toBe(false)
  })

  it("returns false for TelegramConfig (no webhookUrl field)", () => {
    const config: NotificationConfig = { botToken: "bot123", chatId: "chat456" }
    expect(isDiscordConfig(config)).toBe(false)
  })

  it("returns false for EmailConfig (no webhookUrl field)", () => {
    const config: NotificationConfig = {
      host: "smtp.example.com",
      port: 587,
      username: "user",
      password: "pass",
      from: "from@example.com",
      to: "to@example.com",
    }
    expect(isDiscordConfig(config)).toBe(false)
  })

  it("returns true for an empty string webhookUrl (shape check only, not content)", () => {
    // isDiscordConfig validates shape, not URL validity — that is validateNotificationConfig's job
    const config: NotificationConfig = { webhookUrl: "" }
    expect(isDiscordConfig(config)).toBe(true)
  })
})

// ─── isNotificationConfig ─────────────────────────────────────────────────────

describe("isNotificationConfig", () => {
  // ── null / non-object primitives ─────────────────────────────────────────

  it("returns false for null", () => {
    expect(isNotificationConfig(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isNotificationConfig(undefined)).toBe(false)
  })

  it("returns false for a string", () => {
    expect(isNotificationConfig("https://discord.com/api/webhooks/123/abc")).toBe(false)
  })

  it("returns false for a number", () => {
    expect(isNotificationConfig(42)).toBe(false)
  })

  it("returns false for a boolean", () => {
    expect(isNotificationConfig(true)).toBe(false)
  })

  it("returns false for an empty object", () => {
    expect(isNotificationConfig({})).toBe(false)
  })

  it("returns false for an array", () => {
    expect(isNotificationConfig([])).toBe(false)
  })

  // ── Discord / Slack (webhookUrl: string) ─────────────────────────────────

  it("returns true for a valid DiscordConfig shape", () => {
    const config: DiscordConfig = { webhookUrl: "https://discord.com/api/webhooks/123/abc" }
    expect(isNotificationConfig(config)).toBe(true)
  })

  it("returns true for a valid SlackConfig shape (same shape as Discord)", () => {
    const config: SlackConfig = { webhookUrl: "https://hooks.slack.com/services/T/B/X" }
    expect(isNotificationConfig(config)).toBe(true)
  })

  it("returns false when webhookUrl is a number, not a string", () => {
    expect(isNotificationConfig({ webhookUrl: 12345 })).toBe(false)
  })

  it("returns false when webhookUrl is null", () => {
    expect(isNotificationConfig({ webhookUrl: null })).toBe(false)
  })

  it("returns false when webhookUrl is missing but an unrelated string field is present", () => {
    expect(isNotificationConfig({ url: "https://example.com" })).toBe(false)
  })

  // ── Gotify (serverUrl + appToken) ─────────────────────────────────────────

  it("returns true for a valid GotifyConfig shape", () => {
    const config: GotifyConfig = { serverUrl: "https://gotify.example.com", appToken: "tok123" }
    expect(isNotificationConfig(config)).toBe(true)
  })

  it("returns false for partial Gotify — serverUrl present but appToken missing", () => {
    expect(isNotificationConfig({ serverUrl: "https://gotify.example.com" })).toBe(false)
  })

  it("returns false for partial Gotify — appToken present but serverUrl missing", () => {
    expect(isNotificationConfig({ appToken: "tok123" })).toBe(false)
  })

  it("returns false when Gotify appToken is a number, not a string", () => {
    expect(isNotificationConfig({ serverUrl: "https://gotify.example.com", appToken: 9999 })).toBe(
      false
    )
  })

  it("returns false when Gotify serverUrl is a number, not a string", () => {
    expect(isNotificationConfig({ serverUrl: 8080, appToken: "tok123" })).toBe(false)
  })

  // ── Telegram (botToken + chatId) ──────────────────────────────────────────

  it("returns true for a valid TelegramConfig shape", () => {
    const config: TelegramConfig = { botToken: "bot123:ABC", chatId: "-100456789" }
    expect(isNotificationConfig(config)).toBe(true)
  })

  it("returns false for partial Telegram — botToken present but chatId missing", () => {
    expect(isNotificationConfig({ botToken: "bot123" })).toBe(false)
  })

  it("returns false for partial Telegram — chatId present but botToken missing", () => {
    expect(isNotificationConfig({ chatId: "-100456789" })).toBe(false)
  })

  it("returns false when Telegram chatId is a number, not a string", () => {
    expect(isNotificationConfig({ botToken: "bot123", chatId: 456789 })).toBe(false)
  })

  // ── Email (host + port + from + to; username/password not checked by guard) ──

  it("returns true for a valid EmailConfig shape", () => {
    const config: EmailConfig = {
      host: "smtp.example.com",
      port: 587,
      username: "user",
      password: "pass",
      from: "from@example.com",
      to: "to@example.com",
    }
    expect(isNotificationConfig(config)).toBe(true)
  })

  it("returns true for EmailConfig with minimum required fields (host/port/from/to)", () => {
    // username and password are not checked by the type guard
    expect(
      isNotificationConfig({ host: "smtp.example.com", port: 587, from: "a@b.com", to: "c@d.com" })
    ).toBe(true)
  })

  it("returns false for partial Email — port missing", () => {
    expect(isNotificationConfig({ host: "smtp.example.com", from: "a@b.com", to: "c@d.com" })).toBe(
      false
    )
  })

  it("returns false for partial Email — host missing", () => {
    expect(isNotificationConfig({ port: 587, from: "a@b.com", to: "c@d.com" })).toBe(false)
  })

  it("returns false for partial Email — from missing", () => {
    expect(isNotificationConfig({ host: "smtp.example.com", port: 587, to: "c@d.com" })).toBe(false)
  })

  it("returns false for partial Email — to missing", () => {
    expect(isNotificationConfig({ host: "smtp.example.com", port: 587, from: "a@b.com" })).toBe(
      false
    )
  })

  it("returns false when Email port is a string, not a number", () => {
    expect(
      isNotificationConfig({
        host: "smtp.example.com",
        port: "587",
        from: "a@b.com",
        to: "c@d.com",
      })
    ).toBe(false)
  })

  it("returns false when Email host is a number, not a string", () => {
    expect(
      isNotificationConfig({ host: 1234, port: 587, from: "a@b.com", to: "c@d.com" })
    ).toBe(false)
  })
})
