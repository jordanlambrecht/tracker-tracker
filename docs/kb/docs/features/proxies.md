---
title: Proxies
description: Route tracker polling through SOCKS5, HTTP, or HTTPS proxies on a per-tracker basis.
---

# Proxies

!!! warning "Experimental"
    Proxy support is experimental and may not work with all trackers or proxy configurations. Use at your own risk.

You can route outbound tracker API requests through a proxy. Proxy support is opt-in — you configure one global proxy, and then individually enable it per tracker.

## Supported Proxy Types

| Type     | Common use                                      |
| -------- | ----------------------------------------------- |
| `socks5` | Tor, SSH tunnels, most privacy-oriented proxies |
| `http`   | Standard HTTP CONNECT proxies                   |
| `https`  | TLS-wrapped HTTP CONNECT proxies                |

The proxy type controls how your traffic reaches the proxy server — SOCKS5 for tunnel-level proxying, HTTP/HTTPS for CONNECT-based proxying. Either way, the actual request to the tracker is always HTTPS, so your API token is encrypted end-to-end regardless of proxy type.

When a proxy is enabled for a tracker, the tracker sees the proxy's IP address — not yours.

!!! warning "Some trackers ban proxy and VPN traffic"
    Many private trackers explicitly prohibit accessing the site from VPNs, proxies, or shared IPs. Using a proxy for API polling may trigger automated security flags or get your account disabled. Check your tracker's rules before enabling this. If a tracker allows API access from a different IP than your browsing IP, you're probably fine — but not all trackers make that distinction.

!!! info "DNS resolution"
    HTTP and HTTPS proxies resolve the tracker's hostname on the proxy side — your local DNS provider never sees the domain. SOCKS5 behavior depends on configuration: most SOCKS5 proxies also resolve remotely, but some setups resolve locally first. If DNS privacy matters to you, verify your SOCKS5 proxy does remote resolution.

## Setup

Proxy settings live in **Settings → General → Proxy**.

### Step 1: Configure the global proxy

Fill in the proxy details:

| Field      | Description                                               |
| ---------- | --------------------------------------------------------- |
| Proxy type | `socks5`, `http`, or `https`                              |
| Host       | Hostname or IP address of your proxy server               |
| Port       | Port number (commonly `1080` for SOCKS5, `8080` for HTTP) |
| Username   | Optional — only needed for authenticated proxies          |
| Password   | Optional — stored securely, never in plaintext            |

The master switch at the top of the proxy section enables or disables the proxy globally. Even if individual trackers have the proxy toggled on, nothing is routed through the proxy while the master switch is off.

### Step 2: Enable the proxy per tracker

On any tracker's settings page, toggle **Use Proxy**. That tracker's polls will then go through the global proxy.

Trackers with the toggle off always poll directly, even if a global proxy is configured.

## Credential Security

Your proxy password is encrypted at rest. It's decrypted in memory only when a poll is about to run, used for the request, and never written to logs.

## Troubleshooting

| Error message                                                        | What it means                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to create proxy agent (check proxy host/port configuration)` | The host or port format is invalid. Double-check there are no typos and no `http://` prefix in the host field.                                          |
| `Failed to decrypt proxy password, proceeding without auth`          | The proxy password couldn't be read — this can happen after a restore from a backup with a different password. Re-enter the proxy password in settings. |
| `Request timed out after 15000ms`                                    | The proxy or tracker didn't respond within 15 seconds. Check that the proxy is running and reachable.                                                   |
| `proxyFetch only supports HTTPS URLs`                                | The tracker URL is using `http://` — change it to `https://`.                                                                                           |

## Proxy Host Format

The host field accepts:

- Hostnames: `proxy.example.com`
- IPv4 addresses: `192.0.2.1`
- IPv6 addresses: `[2001:db8::1]` (bracket notation supported)

Do not include a protocol prefix (`http://`, `socks5://`) in the host field.
