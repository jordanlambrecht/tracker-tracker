---
title: Tracker Showing as Offline or Paused
description: What the PulseDot states mean, how automatic poll pausing works, and how to get a paused tracker polling again.
---

# Tracker Showing as Offline or Paused

## Understanding PulseDot states

The PulseDot next to each tracker name is the first place to look. It reflects the tracker's current health based on its last known data and any recent poll errors.

| State      | Color | Meaning                                                                            |
| ---------- | ----- | ---------------------------------------------------------------------------------- |
| `healthy`  | Cyan  | Ratio ≥ 2.0 — polling normally                                                     |
| `warning`  | Amber | Ratio between 1.0 and 2.0, or ratio is fine but zero active seeds                  |
| `critical` | Red   | Ratio < 1.0, or the tracker has warned your account                                |
| `error`    | Red   | The last poll failed, but polling has not paused yet                               |
| `paused`   | Red   | Polling has been automatically suspended after repeated failures                   |
| `offline`  | Gray  | No snapshot data exists yet (tracker was just added, or all snapshots were pruned) |

The `paused` and `error` states are what you will see when a tracker goes offline or becomes unreachable.

---

## Automatic poll pausing

After **4 consecutive failed polls**, the tracker is automatically paused. This prevents repeated failed requests to a broken or unreachable tracker.

When this happens:

- The PulseDot switches to the `paused` state.
- The **Poll Error Banner** appears at the top of the tracker's detail page showing:
  - The heading **"Polling Paused"** in red
  - The timestamp when polling was paused
  - The last recorded error (e.g. `Authentication failed`, `Host not found`)
  - A **Resume Polling** button

Paused trackers are skipped entirely until you manually resume them.

!!! warning "Verify the cause before resuming"
    The banner reads: _"Polling was paused after repeated failures. Verify your API key is correct before resuming."_ If you resume without fixing the underlying problem, the tracker will fail again immediately and re-pause within the same poll cycle.

---

## Resuming a paused tracker

1. Open the tracker's detail page.
2. Find the **Poll Error Banner** near the top. The last error is listed below the "Polling Paused" heading.
3. Fix the underlying problem (see sections below).
4. Click **Resume Polling**.

After resuming, click **Poll Now** to verify the fix works immediately rather than waiting for the next scheduled poll.

---

## Common causes and solutions

### Invalid or expired API key

This is the most common cause. Your tracker API key may have been regenerated, revoked, or entered incorrectly.

**Symptom:** The Poll Error Banner shows `Authentication failed`.

!!! success "Solution"
    1. Log into your tracker's website and go to your profile or security settings.
    2. Find your API token (often under "Security", "API", or "Edit Profile").
    3. Copy the current token.
    4. In Tracker Tracker, open the tracker's settings (edit icon on the tracker detail page or tracker list).
    5. Paste the new token into the API Token field and save.
    6. Click **Resume Polling**, then **Poll Now** to verify.

---

### Proxy misconfiguration

If a tracker has **Use Proxy** enabled, Tracker Tracker will not fall back to a direct connection. If the proxy is unreachable or misconfigured, every poll fails.

**Symptom:** The Poll Error Banner shows `Proxy connection failed`. The tracker has "Use Proxy" toggled on in its settings.

!!! success "Solution"
    1. Go to **Settings → Proxy** and verify the proxy host, port, type (SOCKS5/HTTP/HTTPS), and credentials.
    2. Confirm the proxy server is running and reachable from your Docker host.
    3. If you want to bypass the proxy for this tracker, edit the tracker settings and disable **Use Proxy**.
    4. Resume polling after fixing.

---

### DNS resolution failure

The tracker's hostname cannot be resolved. This may be a temporary DNS outage, a typo in the base URL, or a DNS issue inside Docker.

**Symptom:** The Poll Error Banner shows `Host not found`.

!!! success "Solution"
    1. Check the tracker's base URL for typos in the hostname.
    2. From your Docker host, test resolution: `nslookup tracker.example.com`.
    3. If you use custom DNS or a VPN, confirm DNS is available inside the container network. You may need to add a `dns:` entry to your `docker-compose.yml`.
    4. If the tracker's domain has changed, update the base URL in the tracker settings.

---

### Tracker is genuinely unreachable

The hostname resolved but the connection was refused or the host was unreachable.

**Symptom:** The Poll Error Banner shows `Connection refused` or `Host unreachable`.

!!! success "Solution"
    1. Check whether the tracker site loads in your browser.
    2. If the tracker is down, wait for it to recover, then resume polling.
    3. If you route tracker traffic through a VPN, confirm the VPN is up.
    4. Verify the base URL uses the correct scheme (`https://` vs `http://`) and the right port if the tracker uses a non-standard one.

---

### Request timeout

The connection was established but the tracker API did not respond within 15 seconds.

**Symptom:** The Poll Error Banner shows `Request timed out`.

!!! success "Solution"
    1. This is often transient. Try **Poll Now** again after a few minutes.
    2. If timeouts are persistent, check whether a proxy is adding significant latency.
    3. If the tracker's API is consistently slow, there is no configurable timeout override.

---

### Rate limiting

Some trackers block repeated requests from a single IP if polls come in too frequently.

**Symptom:** The Poll Error Banner shows `IP temporarily banned by tracker`.

!!! success "Solution"
    1. Go to **Settings → General** and increase the **Poll Interval**. The minimum is 15 minutes, but 60 minutes (the default) is recommended for most trackers.
    2. Wait for the IP ban to expire on the tracker side — this varies by site, typically minutes to hours.
    3. Resume polling only after the ban has likely cleared.

---

### Stale error banner (no pause)

If polling has not paused but you still see a **Last Error** banner — without the "Polling Paused" heading — it means a recent poll failed but not enough times to trigger a pause. The banner clears automatically on the next successful poll.

!!! info "No action needed if the last poll succeeded"
    The Last Error banner always shows the most recent error, even if subsequent polls recovered. If the PulseDot is `healthy`, `warning`, or `critical` (not `error` or `paused`), polling has already recovered on its own.
