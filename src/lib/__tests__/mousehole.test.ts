// src/lib/__tests__/mousehole.test.ts

import { describe, expect, it } from "vitest"
import { mouseholeStatus, stripUrlCredentials } from "@/lib/mousehole"

describe("stripUrlCredentials", () => {
  it("removes userinfo so the URL is safe to link", () => {
    expect(stripUrlCredentials("https://user:pw@mousehole.example.org/")).toBe(
      "https://mousehole.example.org"
    )
  })

  it("removes a token in the password slot", () => {
    expect(stripUrlCredentials("http://:fake-token-7f3a@mousehole-test:5010")).toBe(
      "http://mousehole-test:5010"
    )
  })

  it("leaves an @ after the authority alone", () => {
    expect(stripUrlCredentials("http://mousehole-test:5010/path?user=a@b")).toBe(
      "http://mousehole-test:5010/path?user=a@b"
    )
  })

  // Browsers read a backslash after the authority as a path separator, and a
  // query or fragment can start without any path.
  it("stops at a backslash, a query or a fragment", () => {
    expect(stripUrlCredentials("http://mousehole-test:5010\\path@b")).toBe(
      "http://mousehole-test:5010\\path@b"
    )
    expect(stripUrlCredentials("http://mousehole-test:5010?user=a@b")).toBe(
      "http://mousehole-test:5010?user=a@b"
    )
    expect(stripUrlCredentials("http://mousehole-test:5010#a@b")).toBe(
      "http://mousehole-test:5010#a@b"
    )
  })
})

describe("mouseholeStatus", () => {
  it("maps each contact result to a label and tone", () => {
    expect(mouseholeStatus("ok")).toEqual({ label: "OK", tone: "success" })
    expect(mouseholeStatus("throttled").tone).toBe("warn")
    expect(mouseholeStatus("no-cookie").tone).toBe("warn")
    expect(mouseholeStatus("pending").tone).toBe("warn")
    expect(mouseholeStatus("rejected").tone).toBe("danger")
    expect(mouseholeStatus("unreachable").tone).toBe("danger")
    expect(mouseholeStatus(null)).toEqual({ label: "Down", tone: "danger" })
  })
})
