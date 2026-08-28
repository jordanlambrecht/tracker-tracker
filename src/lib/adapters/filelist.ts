// src/lib/adapters/filelist.ts
//
// Functions: parseFilelistCredentials

import { parseCredentialJson, validateCookieHeader } from "./cookie-credentials"

// ---------------------------------------------------------------------------
// Credential handling
//
// FileList has no user API key. The 32-char passkey only authenticates the
// torrent-search api.php (search-torrents / latest-torrents); user stats exist
// only in logged-in HTML. So the adapter authenticates with pasted browser
// cookies plus the exact User-Agent the session was issued to, the same way
// IPTorrents does.
// ---------------------------------------------------------------------------

export interface FilelistCredentials {
  cookies: string
  userAgent: string
}

export function parseFilelistCredentials(apiToken: string): FilelistCredentials {
  const { cookies, userAgent } = parseCredentialJson(apiToken, "FileList", [
    "cookies",
    "userAgent",
  ] as const)

  return {
    cookies: validateCookieHeader(cookies, {
      extraCookieNames: ["uid", "pass"],
      example: "uid=123; pass=abc123",
    }),
    userAgent,
  }
}
