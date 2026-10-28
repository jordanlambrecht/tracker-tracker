// src/components/tracker-detail/__tests__/DebugResponseDialog.test.tsx
//
// The debug dialog is what someone opens when a poll fails. A call the poll
// rejected on a 200 carries the body that caused it, and that body is the part
// worth copying into a report, so it must stay visible under the error.

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  type DebugData,
  DebugResponseDialog,
} from "@/components/tracker-detail/DebugResponseDialog"

const REJECTED_BODY = { status: "success", response: { username: "JohnDoe" } }
const HEALTHY_BODY = {
  status: "success",
  response: { username: "JohnDoe", userstats: { uploaded: 1024, downloaded: 512 } },
}

const DATA: DebugData = {
  apiCalls: [
    {
      label: "Index",
      endpoint: "/ajax.php?action=index",
      data: REJECTED_BODY,
      error: "Unexpected response from redacted.sh: missing userstats",
    },
    {
      label: "User Profile",
      endpoint: "/ajax.php?action=user&id=12345",
      data: null,
      error: "Failed to connect to redacted.sh: ECONNRESET",
    },
  ],
  rawError: null,
  normalized: null,
  normalizedError: "Unexpected response from redacted.sh: missing userstats",
  platform: "gazelle",
  trackerName: "Redacted",
}

describe("DebugResponseDialog raw tab", () => {
  it("prints a rejected body under its error, and only the error when no body arrived", async () => {
    render(<DebugResponseDialog open loading={false} data={DATA} error={null} onClose={vi.fn()} />)

    const raw = await screen.findByText(/missing userstats/)

    expect(raw.textContent).toBe(
      [
        "── Index ── /ajax.php?action=index",
        "Error: Unexpected response from redacted.sh: missing userstats",
        JSON.stringify(REJECTED_BODY, null, 2),
        "",
        "── User Profile ── /ajax.php?action=user&id=12345",
        "Error: Failed to connect to redacted.sh: ECONNRESET",
      ].join("\n")
    )
  })

  it("prints a healthy body alone, and still marks a blank error as an error", async () => {
    const data: DebugData = {
      ...DATA,
      apiCalls: [
        { label: "Index", endpoint: "/ajax.php?action=index", data: HEALTHY_BODY, error: null },
        {
          label: "User Profile",
          endpoint: "/ajax.php?action=user&id=12345",
          data: REJECTED_BODY,
          error: "",
        },
      ],
    }
    render(<DebugResponseDialog open loading={false} data={data} error={null} onClose={vi.fn()} />)

    const raw = await screen.findByText(/action=index/)

    expect(raw.textContent).toBe(
      [
        "── Index ── /ajax.php?action=index",
        JSON.stringify(HEALTHY_BODY, null, 2),
        "",
        "── User Profile ── /ajax.php?action=user&id=12345",
        "Error: ",
        JSON.stringify(REJECTED_BODY, null, 2),
      ].join("\n")
    )
  })
})
