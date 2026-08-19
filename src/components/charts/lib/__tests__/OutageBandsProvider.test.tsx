// src/components/charts/lib/__tests__/OutageBandsProvider.test.tsx
//
// Band scoping lives in useOutageBand The rule that matters most: a tracker-sourced
// chart can never receive a download-client band, because a qBittorrent outage
// cannot flatten a tracker snapshot and a band there would blame the wrong
// system for the dip. Its mirror is pinned too: a qBT-sourced chart never
// receives a tracker band, which is what makes "tracker vs qBT precedence" a
// question that never has to be answered.
//
// The tracker-SCOPED provider is pinned separately: the layout mounts an
// unscoped one, a tracker page nests a scoped one inside it, and only the
// charts below the inner provider may see tracker bands.

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
const TRACKER_GAP = { start: 8_000, end: 9_000 }

function Probe({ source }: { source: ChartDataSource }) {
  const bands = useOutageBands(source)
  return (
    <div>
      <span data-testid="app">{JSON.stringify(bands.app)}</span>
      <span data-testid="qbt">{JSON.stringify(bands.qbt)}</span>
      <span data-testid="tracker">{JSON.stringify(bands.tracker)}</span>
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
const tracker = () => JSON.parse(screen.getByTestId("tracker").textContent ?? "null")

describe("useOutageBands — scoping", () => {
  it("never gives a tracker-sourced chart a download-client band", () => {
    renderProbe("tracker", { enabled: true, app: [APP_GAP], allDown: [QBT_GAP], tracker: [] })

    expect(app()).toEqual([APP_GAP])
    expect(qbt()).toEqual([])
  })

  it("gives a tracker-sourced chart its own tracker bands", () => {
    renderProbe("tracker", {
      enabled: true,
      app: [APP_GAP],
      allDown: [QBT_GAP],
      tracker: [TRACKER_GAP],
    })

    expect(tracker()).toEqual([TRACKER_GAP])
    expect(qbt()).toEqual([])
  })

  it("never gives a qBT-sourced chart a tracker band", () => {
    // The mirror of the rule above. A tracker being unreachable says nothing
    // about the torrents sitting in a download client, so banding a qBT chart
    // for it would blame the wrong system in the other direction. Because
    // neither source can see the other's bands, the two can never co-render and
    // no precedence rule between them is needed.
    renderProbe("qbt", {
      enabled: true,
      app: [APP_GAP],
      allDown: [QBT_GAP],
      tracker: [TRACKER_GAP],
    })

    expect(tracker()).toEqual([])
    expect(qbt()).toEqual([QBT_GAP])
  })

  it("drops tracker bands too when the toggle is off", () => {
    renderProbe("tracker", {
      enabled: false,
      app: [APP_GAP],
      allDown: [QBT_GAP],
      tracker: [TRACKER_GAP],
    })

    expect(tracker()).toEqual([])
  })

  it("gives a qBT-sourced chart both layers", () => {
    renderProbe("qbt", { enabled: true, app: [APP_GAP], allDown: [QBT_GAP], tracker: [] })

    expect(app()).toEqual([APP_GAP])
    expect(qbt()).toEqual([QBT_GAP])
  })

  it("draws nothing at all when the toggle is off", () => {
    renderProbe("qbt", { enabled: false, app: [APP_GAP], allDown: [QBT_GAP], tracker: [] })

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
    fetchMock.mockImplementation(() => ok({ app: [APP_GAP], allDown: [QBT_GAP], tracker: [] }))

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
    fetchMock.mockImplementation(() => ok({ app: [], allDown: [], tracker: [] }))

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

  it("OMITS trackerId when unscoped — this is what keeps bands off the dashboard", () => {
    // The layout's provider takes no trackerId, so the route returns an empty
    // tracker arm and no chart on any other page can draw one. Sending an empty
    // or zero value instead would be rejected by the route as malformed.
    fetchMock.mockImplementation(() => ok({ app: [], allDown: [], tracker: [] }))

    render(
      <OutageBandsProvider>
        <Probe source="tracker" />
      </OutageBandsProvider>
    )

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).not.toContain("trackerId")
  })

  it("sends trackerId when scoped to one tracker", async () => {
    fetchMock.mockImplementation(() => ok({ app: [], allDown: [], tracker: [TRACKER_GAP] }))

    render(
      <OutageBandsProvider trackerId={42}>
        <Probe source="tracker" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(tracker()).toEqual([TRACKER_GAP]))
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toMatch(/^\/api\/uptime\/outages\?from=\d+&to=\d+&trackerId=42$/)
  })

  it("re-requests when the scoped tracker changes", async () => {
    // Navigating between two tracker pages must not leave the previous
    // tracker's bands painted behind the new one's data.
    fetchMock.mockImplementation(() => ok({ app: [], allDown: [], tracker: [] }))

    const { rerender } = render(
      <OutageBandsProvider trackerId={1}>
        <Probe source="tracker" />
      </OutageBandsProvider>
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    rerender(
      <OutageBandsProvider trackerId={2}>
        <Probe source="tracker" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain("trackerId=2")
  })

  it("a NESTED scoped provider wins over the unscoped one above it", async () => {
    // This is the entire mechanism behind "tracker bands on tracker pages only":
    // the layout mounts an unscoped provider, and the tracker page nests a
    // scoped one inside it. React resolves to the nearest provider.
    fetchMock.mockImplementation((input: string) =>
      input.includes("trackerId=7")
        ? ok({ app: [APP_GAP], allDown: [], tracker: [TRACKER_GAP] })
        : ok({ app: [APP_GAP], allDown: [QBT_GAP], tracker: [] })
    )

    render(
      <OutageBandsProvider>
        <OutageBandsProvider trackerId={7}>
          <Probe source="tracker" />
        </OutageBandsProvider>
      </OutageBandsProvider>
    )

    await waitFor(() => expect(tracker()).toEqual([TRACKER_GAP]))
  })

  it("drops a malformed tracker interval rather than drawing a garbage band", async () => {
    fetchMock.mockImplementation(() =>
      ok({ app: [], allDown: [], tracker: [TRACKER_GAP, { start: 20, end: 10 }, null] })
    )

    render(
      <OutageBandsProvider trackerId={3}>
        <Probe source="tracker" />
      </OutageBandsProvider>
    )

    await waitFor(() => expect(tracker()).toEqual([TRACKER_GAP]))
  })
})
