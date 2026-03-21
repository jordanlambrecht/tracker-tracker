---
title: Ratio or Stats Not Updating
description: Why your ratio or other stats appear stale, and how to verify that polling is working correctly.
---

# Ratio or Stats Not Updating

Stats only change when Tracker Tracker records a new snapshot. If your ratio, upload totals, or seeding count look stale, work through the checklist below.

---

## Step 1 — Check the poll interval setting

Go to **Settings → General** and find the **Tracker Poll Interval** field. The value is in minutes. The valid range is 15 to 1440 (one day).

If this is set to 240, stats will only update every 4 hours. That is expected behavior, not a bug.

!!! info "Minimum update rate"
    Setting the interval to 15 minutes is the fastest update rate available. Stats will not update more frequently than this regardless of how often you reload the page.

---

## Step 2 — Verify polling is actually running

Look at the PulseDot next to the tracker name.

| PulseDot state                     | What it means for polling                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `healthy` / `warning` / `critical` | Polling is running. Stats are current as of the last snapshot.                                                                            |
| `error`                            | The last poll failed. The next poll cycle will retry automatically.                                                                       |
| `paused`                           | Polling is suspended. No new snapshots will be recorded until you resume. See [Tracker Showing as Offline or Paused](tracker-offline.md). |
| `offline`                          | No snapshot data exists yet. The tracker may not have been polled.                                                                        |

If the PulseDot is `paused` or `error`, fix the underlying issue before investigating stale stats.

---

## Step 3 — Use Poll Now to trigger an immediate update

You do not need to wait for the next scheduled poll.

1. Open the tracker's detail page.
2. Click the **Poll Now** button near the tracker name.
3. The page will refresh with updated stats if the poll succeeded.

If Poll Now returns an error, the Poll Error Banner will show the reason. See [Tracker Showing as Offline or Paused](tracker-offline.md) for error-specific guidance.

---

## Step 4 — Check the chart time range

The charts on the tracker detail page show data over a selected time range. A narrow range can make it look like nothing has changed even when new snapshots exist.

- Find the **day range selector** in the right sidebar on the Data & Analytics tab.
- Try a broader range (30 days or 90 days) to confirm historical data is present.
- The default view shows the most recent data. If only today is selected, you will only see today's snapshots.

---

## Step 5 — Confirm snapshots are being recorded

If Poll Now succeeds but the charts still do not move, try a hard-refresh first.

1. Hard-refresh the page (`Cmd+Shift+R` on macOS, `Ctrl+Shift+R` on Windows/Linux).
2. Check the **Last Polled** timestamp on the tracker detail page — it should match the time of the most recent poll.
3. If the Last Polled time updated but the chart did not change, the tracker API returned the same values as the previous snapshot. This is normal — the snapshot is still recorded, the values just did not change.

---

## Edge case — Tracker API returns cached data

Some trackers cache their API responses server-side for several minutes. If you poll twice within that cache window, both snapshots will contain identical values. This shows up as a flat line on the chart.

There is no workaround for this. The data reflects exactly what the tracker API reported. A longer poll interval (30-60 minutes) is less likely to land inside the tracker's cache window.

---

## Edge case — Snapshot retention pruning

If you have configured a **Snapshot Retention** period in Settings → General, snapshots older than that window are automatically deleted after each poll cycle.

If retention is set to 7 days and you are looking at a 30-day chart, the older portion of the chart will be empty. That data was pruned.

!!! tip "Retention defaults"
    If retention is not configured, snapshots are kept forever. If you see gaps in older data, check the retention setting in Settings → General.
