// src/lib/__tests__/extract-api-error.test.ts

import { describe, expect, it } from "vitest"
import { extractApiError } from "@/lib/extract-api-error"

describe("extractApiError", () => {
  it("returns the error field from a JSON response", async () => {
    const res = new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
    expect(await extractApiError(res)).toBe("Bad request")
  })

  it("returns the default fallback when error field is undefined", async () => {
    const res = new Response(JSON.stringify({ error: undefined }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
    expect(await extractApiError(res)).toBe("Request failed")
  })

  it("returns the default fallback when JSON has no error field", async () => {
    const res = new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
    expect(await extractApiError(res)).toBe("Request failed")
  })

  it("returns the default fallback on invalid JSON", async () => {
    const res = new Response("not json", {
      status: 500,
    })
    expect(await extractApiError(res)).toBe("Request failed")
  })

  it("returns a custom fallback string when provided", async () => {
    const res = new Response("not json", { status: 503 })
    expect(await extractApiError(res, "Service unavailable")).toBe("Service unavailable")
  })
})
