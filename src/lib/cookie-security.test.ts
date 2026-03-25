// src/lib/cookie-security.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { shouldSecureCookies } from "./cookie-security"

describe("shouldSecureCookies", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns true when SECURE_COOKIES is the string 'true'", () => {
    vi.stubEnv("SECURE_COOKIES", "true")
    expect(shouldSecureCookies()).toBe(true)
  })

  it("returns false when SECURE_COOKIES is the string 'false'", () => {
    vi.stubEnv("SECURE_COOKIES", "false")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns false when SECURE_COOKIES is '1' (non-canonical truthy string)", () => {
    vi.stubEnv("SECURE_COOKIES", "1")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns false when SECURE_COOKIES is 'TRUE' (wrong case)", () => {
    vi.stubEnv("SECURE_COOKIES", "TRUE")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns true when BASE_URL starts with https://", () => {
    vi.stubEnv("BASE_URL", "https://trackertracker.example.com")
    expect(shouldSecureCookies()).toBe(true)
  })

  it("returns true when BASE_URL starts with HTTPS:// (uppercase scheme)", () => {
    vi.stubEnv("BASE_URL", "HTTPS://trackertracker.example.com")
    expect(shouldSecureCookies()).toBe(true)
  })

  it("returns true when BASE_URL starts with Https:// (mixed case scheme)", () => {
    vi.stubEnv("BASE_URL", "Https://trackertracker.example.com")
    expect(shouldSecureCookies()).toBe(true)
  })

  it("returns false when BASE_URL starts with http://", () => {
    vi.stubEnv("BASE_URL", "http://trackertracker.local")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns false when BASE_URL starts with HTTP:// (uppercase http)", () => {
    vi.stubEnv("BASE_URL", "HTTP://trackertracker.local")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns false when neither SECURE_COOKIES nor BASE_URL is set", () => {
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns false when NODE_ENV is production but no SECURE_COOKIES or https BASE_URL", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("SECURE_COOKIES=true takes precedence regardless of BASE_URL scheme", () => {
    vi.stubEnv("SECURE_COOKIES", "true")
    vi.stubEnv("BASE_URL", "http://trackertracker.local")
    expect(shouldSecureCookies()).toBe(true)
  })

  it("returns false when BASE_URL is an empty string", () => {
    vi.stubEnv("BASE_URL", "")
    expect(shouldSecureCookies()).toBe(false)
  })

  it("returns false when BASE_URL contains https in the path but not the scheme", () => {
    vi.stubEnv("BASE_URL", "http://example.com/redirect?to=https://other.com")
    expect(shouldSecureCookies()).toBe(false)
  })
})
