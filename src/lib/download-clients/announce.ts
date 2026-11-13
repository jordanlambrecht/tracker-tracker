// src/lib/download-clients/announce.ts
//
// Functions:
//   announceHost - An announce URL's host and port, its path, query and userinfo dropped

/**
 * Host and port as `new URL` gives them, "tracker.example.org:6969", with no
 * port when it is the scheme's default. It drops the path, query and userinfo,
 * which is where a passkey sits, and keeps a udp:// tracker's host. "" for
 * anything it cannot parse.
 */
export function announceHost(announce: unknown): string {
  if (typeof announce !== "string") return ""
  try {
    return new URL(announce).host
  } catch {
    return ""
  }
}
