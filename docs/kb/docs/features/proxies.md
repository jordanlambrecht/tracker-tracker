---
title: Proxies
description: Route tracker polling through SOCKS5, HTTP, or HTTPS proxies on a per-tracker basis.
---

# Proxies

!!! warning "Experimental"
    Proxy support is experimental and may not work with all trackers or proxy configurations. Use at your own risk.

Route tracker API requests through a proxy. Set up one global proxy, then enable it per tracker.

## Supported Proxy Types

| Type     | Common use                                      |
|----------|-------------------------------------------------|
| `socks5` | Tor, SSH tunnels, most privacy-oriented proxies |
| `http`   | Standard HTTP CONNECT proxies                   |
| `https`  | TLS-wrapped HTTP CONNECT proxies                |

The proxy type controls how traffic reaches the proxy server. SOCKS5 uses tunnel-level proxying, HTTP/HTTPS uses CONNECT-based proxying. Either way, tracker requests stay HTTPS, keeping your API token encrypted. When enabled, the tracker sees the proxy's IP instead of yours.

!!! warning "Some trackers ban proxy and VPN traffic"
    Many private trackers prohibit access from VPNs, proxies, or shared IPs. Using a proxy for API polling may trigger security flags or get you disabled. Check your tracker's rules first. If a tracker allows API access from a different IP than your browsing IP, you're probably fine — but not all make that distinction.

!!! info "DNS resolution"
    HTTP and HTTPS proxies resolve on the proxy side — your DNS provider never sees it. SOCKS5 varies: most resolve remotely, some resolve locally first. If DNS privacy matters, verify your SOCKS5 proxy does remote resolution.

## Setup

Proxy settings are in **Settings → General → Proxy**.

### Step 1: Configure the global proxy

Fill in your proxy details:

| Field      | Description                                               |
|------------|-----------------------------------------------------------|
| Proxy type | `socks5`, `http`, or `https`                              |
| Host       | Hostname or IP of your proxy                              |
| Port       | Port number (commonly `1080` for SOCKS5, `8080` for HTTP) |
| Username   | Optional — for authenticated proxies only                 |
| Password   | Optional — stored securely, never plaintext               |

The master switch controls the proxy globally. Even if trackers have the toggle on, nothing routes through while the master switch is off.

### Step 2: Enable per tracker

On a tracker's settings page, toggle **Use Proxy**. That tracker's polls go through the global proxy.

Trackers with the toggle off always poll directly.

## Credential Security

Your proxy password is encrypted at rest. It's decrypted in memory only when polling starts, used for the request, and never logged.

## Troubleshooting

| Error message                                                        | What it means                                                                                                                                    |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `Failed to create proxy agent (check proxy host/port configuration)` | Invalid host or port format. Check for typos and no `http://` prefix in the host field.                                                          |
| `Failed to decrypt proxy password, proceeding without auth`          | The proxy password couldn't be read — can happen after restore from a backup with a different password. Re-enter the proxy password in settings. |
| `Request timed out after 15000ms`                                    | The proxy or tracker didn't respond in 15 seconds. Check that the proxy is running and reachable.                                                |
| `proxyFetch only supports HTTPS URLs`                                | The tracker URL uses `http://` — change it to `https://`.                                                                                        |

## Proxy Host Format

The host field accepts:

- Hostnames: `proxy.example.com`
- IPv4 addresses: `192.0.2.1`
- IPv6 addresses: `[2001:db8::1]` (bracket notation supported)

Do not include a protocol prefix (`http://`, `socks5://`) in the host field.
