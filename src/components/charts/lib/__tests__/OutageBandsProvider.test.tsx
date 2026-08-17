// src/components/charts/lib/__tests__/OutageBandsProvider.test.tsx
//
// Band SCOPING lives in useOutageBands, so it is pinned once here rather than
// re-tested in every chart file. The rule that matters most: a tracker-sourced
// chart can never receive a download-client band, because a qBittorrent outage
// cannot flatten a tracker snapshot and a band there would blame the wrong
// system for the dip.

import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const settingsState = {
  settings: { showOutageBands: true },
  loaded: true,
}

vi.mock("@/components/dashboard/useDashboardSettings", () => ({
  useDashboardSettings: () => settingsState,
}))

import {
  OutageBandsContext,
  OutageBandsProvider,
  type OutageBandsValue,
  useOutageBands,
} from "../OutageBandsProvider"
import type { ChartDataSource } from "../outage-bands"

const APP_GAP = { start: 1_000, end: 2_000 }
const QBT_GAP = { start: 5_000, end: 6_000 }

function Probe({ source }: { source: ChartDataSource }) {
  const bands = useOutageBands(source)
  return (
    <div>
      <span data-testid="app">{JSON.stringify(bands.app)}</span>
      <span data-testid="qbt">{JSON.stringify(bands.qbt)}</span>
    </div>
  )
}

function renderProbe(source: ChartDataSource, value: OutageBandsValue) {
  return render(
    <OutageBandsContext.Provider value={value}>
      <Probe source={source} />
    </OutageBandsContext.Provider>
  )
}

const app = () => JSON.parse(screen.getByTestId("app").textContent ?? "null")
const qbt = () => JSON.parse(screen.getByTestId("qbt").textContent ?? "null")

describe("useOutageBands — scoping", () => {
  it("never gives a tracker-sourced chart a download-client band", () => {
    renderProbe("tracker", { enabled: true, app: [APP_GAP], allDown: [QBT_GAP] })

    expect(app()).toEqual([APP_GAP])
    expect(qbt()).toEqual([])
  })

  it("gives a qBT-sourced chart both layers", () => {
    renderProbe("qbt", { enabled: true, app: [APP_GAP], allDown: [QBT_GAP] })

    expect(app()).toEqual([APP_GAP])
    expect(qbt()).toEqual([QBT_GAP])
  })

  it("draws nothing at all when the toggle is off", () => {
    renderProbe("qbt", { enabled: false, app: [APP_GAP], allDown: [QBT_GAP] })

    expect(app()).toEqual([])
    expect(qbt()).toEqual([])
  })

  it("draws nothing when no provider is mounted, rather than throwing", () => {
    // Charts are rendered bare in unit tests and on pages outside the
    // authenticated layout. The absence of a ledger is UNKNOWN, not an error.
    render(<Probe source="qbt" />)

    expect(app()).toEqual([])
    expect(qbt()).toEqual([])
  })
})

describe("OutageBandsProvider", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    settingsState.settings.showOutageBands = true
    settingsState.loaded = true
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function ok(body: unknown) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
  }

  it("fetches once and shares the result with every chart below it", async () => {
    fetchMock.mockImplementation(() => ok({ app: [APP_GAP], allDown: [QBT_GAP] }))

    render(
      <OutageBandsProvider>
        <Probe source="qbt" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(app()).toEqual([APP_GAP]))
    expect(qbt()).toEqual([QBT_GAP])
  })

  it("does not request the ledger at all when the toggle is off", () => {
    settingsState.settings.showOutageBands = false

    render(
      <OutageBandsProvider>
        <Probe source="qbt" />
      </OutageBandsProvider>
    )

    expect(fetchMock).not.toHaveBeenCalled()
    expect(app()).toEqual([])
  })

  it("waits for the server-confirmed setting before requesting", () => {
    // "On by default" is a guess until the settings GET resolves. Acting on the
    // guess would flash bands in for someone who had turned them off.
    settingsState.loaded = false

    render(
      <OutageBandsProvider>
        <Probe source="qbt" />
      </OutageBandsProvider>
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("draws nothing when the ledger request fails", async () => {
    // The tables do not exist until `pnpm db:push` runs, and the route 500s
    // until then. A failure has to read as UNKNOWN, never as a band.
    fetchMock.mockImplementation(() => Promise.reject(new Error("boom")))

    render(
      <OutageBandsProvider>
        <Probe source="qbt" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(app()).toEqual([])
    expect(qbt()).toEqual([])
  })

  it("drops malformed intervals rather than drawing a garbage band", async () => {
    fetchMock.mockImplementation(() =>
      ok({
        app: [APP_GAP, { start: 9, end: 9 }, { start: 20, end: 10 }, { start: "x", end: 5 }, null],
        allDown: "not an array",
      })
    )

    render(
      <OutageBandsProvider>
        <Probe source="qbt" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(app()).toEqual([APP_GAP]))
    expect(qbt()).toEqual([])
  })

  it("asks for a bounded window with a request timeout", async () => {
    fetchMock.mockImplementation(() => ok({ app: [], allDown: [] }))

    render(
      <OutageBandsProvider>
        <Probe source="qbt" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/^\/api\/uptime\/outages\?from=\d+&to=\d+$/)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
