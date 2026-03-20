---
title: Common Error Messages
description: A reference for error messages shown in the Poll Error Banner and download client status, with causes and solutions.
---

# Common Error Messages

This page maps the error strings shown in the Tracker Tracker interface to their likely causes and fixes.

---

## Tracker poll errors

These appear in the **Poll Error Banner** on the tracker detail page, under the "Last Error" or "Polling Paused" heading.

---

### `Authentication failed`

**Cause:** The tracker rejected the API token. This covers HTTP 401 and 403 responses, as well as explicit "Unauthorized" or "Forbidden" messages from the tracker API.

**Common reasons:**

- The API token was regenerated on the tracker site and the one stored in Tracker Tracker is no longer valid.
- The token was entered incorrectly (extra whitespace, partial copy).
- Your account's API access was revoked or restricted.
- The tracker requires a specific IP allowlist for API access.

!!! success "Solution"
    1. Log into the tracker website and go to your profile or security settings.
    2. Regenerate or copy your current API token.
    3. Open the tracker settings in Tracker Tracker and replace the token.
    4. Click **Resume Polling** on the tracker detail page, then **Poll Now** to verify.

---

### `Host not found`

**Cause:** DNS resolution failed for the tracker's hostname. The system could not translate the domain name to an IP address.

!!! success "Solution"
    1. Check the tracker's base URL for typos (e.g. `tracker.exmaple.com` instead of `tracker.example.com`).
    2. Test DNS from your Docker host: `nslookup <tracker-hostname>`.
    3. If you use a VPN or custom DNS, confirm DNS is accessible inside the container. Add a `dns:` directive to `docker-compose.yml` if needed.
    4. If the tracker's domain has changed, update the base URL in tracker settings.

---

### `Host unreachable`

**Cause:** The hostname resolved but the host could not be reached at the network layer. The route to the IP does not exist, or a firewall is silently dropping packets.

!!! success "Solution"
    1. Check whether the tracker is accessible from your browser.
    2. If you use a VPN or firewall to route tracker traffic, verify those are up.
    3. Confirm there is no egress firewall on your Docker host blocking outbound connections.

---

### `Connection refused`

**Cause:** The host was reached but actively refused the connection. The most common cause is a wrong port — nothing is listening there — or the tracker's web server is down.

!!! success "Solution"
    1. Verify the base URL includes the correct port if the tracker uses a non-standard one.
    2. Check the scheme (`https://` vs `http://`) — a mismatch will produce a refused or reset connection.
    3. Confirm the tracker site is responding normally in a browser.

---

### `Connection reset`

**Cause:** The connection was established and then immediately terminated by the remote host. Often caused by SSL/TLS mismatches, invalid certificates, or the remote server closing the connection unexpectedly.

!!! success "Solution"
    1. Confirm the scheme in the base URL matches what the tracker requires (`https://`).
    2. Self-signed certificates are not currently supported — the TLS handshake will fail.

---

### `Request timed out`

**Cause:** The tracker API accepted the connection but did not return a response within 15 seconds. This can happen during maintenance windows or when the API is under heavy load.

!!! success "Solution"
    1. Wait a few minutes and use **Poll Now** to retry manually.
    2. If timeouts are persistent, check whether a proxy is adding latency.
    3. The 15-second timeout is fixed and cannot be changed.

---

### `IP temporarily banned by tracker`

**Cause:** The tracker's rate-limiting or abuse detection blocked your IP. This can happen if the poll interval is too short, or if the tracker treats automated requests as abusive.

!!! success "Solution"
    1. Wait for the ban to expire — this is enforced on the tracker side and typically lasts minutes to hours depending on the site's policy.
    2. Once the ban clears, go to **Settings → General** and increase the poll interval. 60 minutes is the recommended default; some trackers enforce stricter limits.
    3. Resume polling only after the ban has likely expired.
    4. Do **not** set the poll interval below 30 minutes on trackers known to be sensitive to API traffic.

---

### `Proxy connection failed`

**Cause:** The tracker has **Use Proxy** enabled, and the proxy server was unreachable or returned an error. Tracker Tracker will not silently bypass a required proxy and make a direct connection.

!!! success "Solution"
    1. Go to **Settings → Proxy** and verify the proxy host, port, type, username, and password.
    2. Confirm the proxy server is running and reachable from the Docker container.
    3. To disable the proxy for a specific tracker, edit the tracker settings and turn off **Use Proxy**.

---

### `API returned <status code>`

**Cause:** The tracker's API responded with an unexpected HTTP status code. For example, `API returned 429` indicates HTTP-level rate limiting; `API returned 500` indicates a tracker-side server error.

!!! success "Solution"
    - **429:** Reduce the poll interval and wait for the tracker to clear the rate limit.
    - **500 / 503:** The tracker API is having issues — wait and retry later.
    - **Other codes:** Check the tracker's status page or community forums.

---

### `Poll failed` (generic)

**Cause:** An unexpected error occurred that did not match any of the known patterns above.

!!! success "Solution"
    Check the Tracker Tracker server logs (`docker compose logs app`) for the full error. Look for a line containing `Poll failed for tracker` followed by the raw error string.

---

## Download client errors

These appear on the **Download Clients** panel in Settings, on individual client cards.

---

### `Authentication failed` (qBittorrent)

**Cause:** qBittorrent rejected the username/password combination.

!!! success "Solution"
    1. In qBittorrent's Web UI settings, confirm the username and password.
    2. Update the credentials in **Settings → Download Clients** (edit the client card).
    3. Use the **Test Connection** button after saving to verify.

---

### `Session expired` (qBittorrent — auto-handled)

**Cause:** qBittorrent returned a 403 on an authenticated request, indicating the session has expired. Tracker Tracker handles this automatically by re-authenticating on the next request.

!!! info "No action needed"
    Session expiry is handled transparently. If you see persistent errors in the **Download Clients** panel, the issue is more likely wrong credentials rather than session expiry.

---

### `Connection refused` (qBittorrent)

**Cause:** The qBittorrent Web UI is not accessible at the configured host and port.

!!! success "Solution"
    1. Verify the host and port match the qBittorrent Web UI configuration.
    2. Confirm qBittorrent is running with the Web UI enabled.
    3. If qBittorrent is on a different machine or container, confirm the port is reachable from the Tracker Tracker container.
    4. Check the SSL toggle — a mismatch between qBittorrent's actual scheme and what Tracker Tracker expects will cause failures.

---

### `Host not found` (qBittorrent)

**Cause:** DNS resolution failed for the qBittorrent host.

!!! success "Solution"
    Use the container name (if qBittorrent is in the same Docker Compose stack) or an IP address instead of a hostname that depends on external DNS.

---

### `Request timed out` (qBittorrent)

**Cause:** qBittorrent accepted the connection but did not respond within 15 seconds. This can happen during heavy indexing operations.

!!! success "Solution"
    Wait for qBittorrent to finish processing and retry. If timeouts are persistent, check qBittorrent's CPU and memory usage.

---

## Authentication and session errors (Tracker Tracker login)

---

### HTTP 429 — Too many failed login attempts

**Cause:** The auto-lockout feature triggered. After a configurable number of consecutive failed login attempts, the app blocks further attempts until the lockout duration expires.

!!! success "Solution"
    Wait for the lockout duration to expire — the remaining time is shown on the login page. If you are locked out and cannot wait, you will need to connect to the database directly and clear the `lockedUntil` field in the `appSettings` table.

---

### TOTP — Invalid code

**Cause:** The 6-digit code was incorrect or expired. TOTP codes are valid for 30 seconds. Clock drift between your authenticator app and the server can cause valid-looking codes to fail.

!!! success "Solution"
    1. Ensure your device's clock is synchronized (NTP). Even a 30-60 second drift can invalidate codes.
    2. Wait for your authenticator to cycle to the next code and try again.
    3. If your clock is correct and codes still fail, use a **backup code** from when you set up TOTP. Backup codes are one-time use and follow the format `XXXX-XXXX`.

---

### TOTP — Lost authenticator / no backup codes

**Cause:** You no longer have access to the authenticator app and have no backup codes.

!!! warning "Database access required"
    There is no in-app recovery path for this situation. You will need to connect to the PostgreSQL database directly and run:

    ```sql
    UPDATE app_settings SET totp_secret = NULL, totp_backup_codes = NULL;
    ```

    TOTP is considered disabled when `totp_secret` is `NULL` — there is no separate enabled/disabled flag. After clearing those columns, log in with your password and reconfigure TOTP.

---

## Errors when adding or editing a tracker

---

### `baseUrl must use https:// or http://`

**Cause:** The URL you entered uses an unsupported scheme (e.g. `ftp://`) or is a bare hostname without a scheme.

!!! success "Solution"
    Prefix the URL with `https://` or `http://`.

---

### `baseUrl must not target localhost or a private network address`

**Cause:** The URL resolves to a private IP range (192.168.x.x, 10.x.x.x, 172.16-31.x.x) or localhost. Tracker Tracker blocks these to prevent your internal network from being probed through the app.

!!! info "By design"
    Tracker URLs must be publicly routable hostnames. Internal or self-hosted trackers only accessible via private IPs cannot be added.
