// src/lib/api-helpers.test.ts

import { describe, expect, it } from "vitest"
import { validateHttpUrl } from "./api-helpers"

describe("validateHttpUrl", () => {
  it("accepts a public HTTPS URL", () => {
    expect(validateHttpUrl("https://aither.cc/api/user")).toBeNull()
  })

  it("rejects loopback hostnames", async () => {
    const response = validateHttpUrl("http://localhost:8080")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects loopback hostnames with trailing dots", async () => {
    const response = validateHttpUrl("http://localhost.:8080")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects loopback IPv4 addresses", async () => {
    const response = validateHttpUrl("http://127.0.0.1:8080")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects RFC1918 private IPv4 ranges", async () => {
    const response = validateHttpUrl("http://192.168.1.25")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects link-local and metadata IPv4 ranges", async () => {
    const response = validateHttpUrl("http://169.254.169.254/latest/meta-data")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects loopback IPv6 addresses", async () => {
    const response = validateHttpUrl("http://[::1]/admin")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects IPv4-mapped IPv6 loopback addresses", async () => {
    const response = validateHttpUrl("http://[::ffff:127.0.0.1]/admin")
    expect(response?.status).toBe(400)
    await expect(response?.json()).resolves.toEqual({
      error: "baseUrl must not target localhost or a private network address",
    })
  })

  it("rejects 10.x.x.x private range", async () => {
    const response = validateHttpUrl("http://10.0.0.1/api")
    expect(response?.status).toBe(400)
  })

  it("rejects 172.16.x.x private range", async () => {
    const response = validateHttpUrl("http://172.16.0.1/api")
    expect(response?.status).toBe(400)
  })

  it("rejects 0.0.0.0", async () => {
    const response = validateHttpUrl("http://0.0.0.0/api")
    expect(response?.status).toBe(400)
  })

  it("rejects IPv6 ULA (fc00::)", async () => {
    const response = validateHttpUrl("http://[fc00::1]/api")
    expect(response?.status).toBe(400)
  })

  it("rejects IPv6 link-local (fe80::)", async () => {
    const response = validateHttpUrl("http://[fe80::1]/api")
    expect(response?.status).toBe(400)
  })

  it("rejects .local mDNS domains", async () => {
    const response = validateHttpUrl("http://tracker.local/api")
    expect(response?.status).toBe(400)
  })

  it("rejects ip6-localhost", async () => {
    const response = validateHttpUrl("http://ip6-localhost/api")
    expect(response?.status).toBe(400)
  })

  it("rejects IPv4-mapped IPv6 hex notation", async () => {
    const response = validateHttpUrl("http://[::ffff:7f00:1]/api")
    expect(response?.status).toBe(400)
  })
})