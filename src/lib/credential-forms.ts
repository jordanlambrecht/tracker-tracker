// src/lib/credential-forms.ts
//
// Functions: resolveFieldLabel, tokenForm, credentialFormFor, credentialFormForPlatform,
//            cleanCookies, checkCookies, validateCredentialValues, buildCredentialBlob

// ---------------------------------------------------------------------------
// One row per platform: what the credential UI asks for, what a valid answer
// looks like, and what gets stored. Client-safe: it imports no adapter code.
// ---------------------------------------------------------------------------

import type { PlatformType } from "@/data/platform-types"
import { validateCookieHeader } from "@/lib/tracker-credentials/cookie-header"

export type CredentialKind = "token" | "cookies" | "cookies-username" | "uid-pass" | "login"

/**
 * A label may depend on the tracker's display name. The AvistaZ network is one
 * platform across several sites, and the Add Tracker dialog names the site the
 * username belongs to.
 */
export type FieldLabel = string | ((trackerName: string) => string)

export interface CredentialFieldCopy {
  /** Omitted where the field renders without one, as the sheet's token input does. */
  label?: FieldLabel
  placeholder?: string
  tooltip?: string
  /** Attach the "adding a tracker" docs link beside the tooltip icon. */
  docs?: boolean
  rows?: number
  /** Warn while typing that the pasted value carries an ellipsis. */
  warnsOnTruncation?: boolean
}

/**
 * Copy for one surface. Which entries are read is decided by the kind, so a
 * `login` row has no `secret` and a `cookies` row has no `password`.
 */
export interface CredentialSurfaceCopy {
  /** The cookie textarea or the token input, whichever the kind renders. */
  secret?: CredentialFieldCopy
  username?: CredentialFieldCopy
  password?: CredentialFieldCopy
  alt2FA?: CredentialFieldCopy
}

interface CredentialFormBase {
  /** Hides the manual Join Date field; the adapter reports the date itself. */
  hidesJoinDate: boolean
  dialog: CredentialSurfaceCopy
  sheet: CredentialSurfaceCopy
}

/** The kinds whose answer is a pasted Cookie header. */
type CookieKind = Extract<CredentialKind, "cookies" | "cookies-username">

/**
 * The cookie kinds carry an `example` because `validateCookieHeader` quotes it
 * back to the user. Splitting the union is what makes tsc require one on
 * exactly those rows.
 */
export type CredentialForm =
  | (CredentialFormBase & { kind: Exclude<CredentialKind, CookieKind> })
  | (CredentialFormBase & {
      kind: CookieKind
      example: string
      extraCookieNames?: readonly string[]
    })

export interface CredentialValues {
  token: string
  cookies: string
  username: string
  password: string
  alt2FAToken: string
}

export const EMPTY_CREDENTIAL_VALUES: CredentialValues = {
  token: "",
  cookies: "",
  username: "",
  password: "",
  alt2FAToken: "",
}

export function resolveFieldLabel(
  label: FieldLabel | undefined,
  trackerName: string
): string | undefined {
  return typeof label === "function" ? label(trackerName) : label
}

// ---------------------------------------------------------------------------
// The table
//
// Copy is per surface and the tests pin both: the dialog says "TorrentLeech
// Username" where the sheet, already under a Credentials heading, says
// "Username". `example` and `extraCookieNames` mirror each adapter's own
// validateCookieHeader call, so the pre-save message matches the server's.
// ---------------------------------------------------------------------------

const SHEET_TOKEN: CredentialSurfaceCopy = { secret: { placeholder: "Paste API token" } }

function tokenForm(placeholder: string, hidesJoinDate = false): CredentialForm {
  return {
    kind: "token",
    hidesJoinDate,
    dialog: { secret: { label: "API Token", placeholder } },
    sheet: SHEET_TOKEN,
  }
}

const UNIT3D_TOKEN = "Your UNIT3D API token"

export const CREDENTIAL_FORMS = {
  unit3d: tokenForm(UNIT3D_TOKEN),
  gazelle: tokenForm("Your Gazelle API key"),
  ggn: tokenForm("Your GGn API key", true),
  nebulance: tokenForm(UNIT3D_TOKEN),
  mam: tokenForm("Your mam_id session cookie"),
  custom: tokenForm(UNIT3D_TOKEN),
  btn: tokenForm(UNIT3D_TOKEN),
  hawke: tokenForm(UNIT3D_TOKEN),

  avistaz: {
    kind: "cookies-username",
    example: "cf_clearance=abc123; session=xyz",
    extraCookieNames: ["love"],
    hidesJoinDate: true,
    dialog: {
      username: {
        label: (trackerName: string) => `${trackerName} Username`,
        placeholder: "Your username on this tracker",
      },
      secret: {
        label: "Browser Cookies",
        tooltip:
          "Open DevTools (F12) → Network tab → click any request → find the Cookie header → right-click it → Copy Value. Do not select the text directly, as Firefox truncates long values in the display.",
        docs: true,
        placeholder: "F12 → Network → any request → Cookie header → right-click → Copy Value",
        rows: 3,
        warnsOnTruncation: true,
      },
    },
    sheet: {
      username: { label: "Username", placeholder: "Your username on this tracker" },
      secret: {
        label: "Browser Cookies",
        placeholder: "Paste Cookie header from DevTools",
        rows: 3,
      },
    },
  },

  digitalcore: {
    kind: "uid-pass",
    hidesJoinDate: true,
    dialog: {
      secret: {
        label: "Session Cookies",
        tooltip:
          "DigitalCore uses session cookies instead of API keys. Open DevTools (F12) → Network → any request → copy the Cookie header value.",
        docs: true,
        placeholder: "uid=56954; pass=abc123def456...",
        rows: 2,
      },
    },
    sheet: {
      secret: {
        label: "Session Cookies",
        tooltip: "Open DevTools (F12) → Network → any request → copy the Cookie header value.",
        docs: true,
        placeholder: "uid=56954; pass=abc123def456...",
        rows: 2,
      },
    },
  },

  iptorrents: {
    kind: "cookies",
    example: "uid=123; pass=abc123",
    extraCookieNames: ["uid", "pass"],
    hidesJoinDate: false,
    dialog: {
      secret: {
        label: "Browser Cookies",
        tooltip:
          "IPTorrents has no API, so stats are read from your logged-in session. Open DevTools (F12) → Network → any request to the site → copy the full Cookie header value.",
        docs: true,
        placeholder: "cf_clearance=...; uid=123456; pass=abc123def456...",
        rows: 3,
      },
    },
    sheet: {
      secret: {
        label: "Browser Cookies",
        tooltip:
          "Open DevTools (F12) → Network → any request to IPTorrents → copy the full Cookie header value.",
        docs: true,
        placeholder: "cf_clearance=...; uid=123456; pass=abc123...",
        rows: 3,
      },
    },
  },

  filelist: {
    kind: "cookies",
    example: "uid=123; pass=abc123",
    extraCookieNames: ["uid", "pass"],
    hidesJoinDate: true,
    dialog: {
      secret: {
        label: "Browser Cookies",
        tooltip:
          "FileList's API is torrent-search only, so stats are read from your logged-in session. Open DevTools (F12) → Network → any request to the site → copy the full Cookie header value.",
        docs: true,
        placeholder: "uid=123456; pass=abc123def456...",
        rows: 3,
      },
    },
    sheet: {
      secret: {
        label: "Browser Cookies",
        tooltip:
          "Open DevTools (F12) → Network → any request to FileList → copy the full Cookie header value.",
        docs: true,
        placeholder: "uid=123456; pass=abc123def456...",
        rows: 3,
      },
    },
  },

  retrotoon: {
    kind: "cookies",
    example: "PHPSESSID=abc123def456",
    extraCookieNames: ["PHPSESSID", "uid", "pass"],
    hidesJoinDate: true,
    dialog: {
      secret: {
        label: "Browser Cookies",
        tooltip:
          "RetroToon's API key only uploads torrents, so stats are read from your logged-in session. Open DevTools (F12) → Network → any request to the site → copy the full Cookie header value.",
        docs: true,
        placeholder: "PHPSESSID=abc123def456...",
        rows: 3,
      },
    },
    sheet: {
      secret: {
        label: "Browser Cookies",
        tooltip:
          "Open DevTools (F12) → Network → any request to RetroToon → copy the full Cookie header value.",
        docs: true,
        placeholder: "PHPSESSID=abc123def456...",
        rows: 3,
      },
    },
  },

  torrentleech: {
    kind: "login",
    hidesJoinDate: false,
    dialog: {
      username: {
        label: "TorrentLeech Username",
        placeholder: "Your TorrentLeech username",
      },
      password: {
        label: "TorrentLeech Password",
        tooltip:
          "TorrentLeech has no API, so stats are read by logging in on your behalf. Your password is encrypted at rest with the same key as every other tracker credential.",
        docs: true,
        placeholder: "Your TorrentLeech password",
      },
      alt2FA: {
        label: "Alt 2FA Token (optional)",
        tooltip:
          "Required only if your TorrentLeech account has 2FA enabled. Find it at Site Profile => Alt 2FA Token. It is a static token, not a rotating 6-digit code.",
        docs: true,
        placeholder: "Only if 2FA is enabled on your account",
      },
    },
    sheet: {
      username: { label: "Username" },
      password: { label: "Password" },
      alt2FA: {
        label: "Alt 2FA Token (optional)",
        placeholder: "Only if 2FA is enabled on your account",
      },
    },
  },
} satisfies Record<PlatformType, CredentialForm>

/**
 * Enrichment is switched on per tracker rather than per platform, so whether a
 * Gazelle row hides the Join Date cannot be read from the table alone.
 */
export function credentialFormFor(entry: {
  platform: PlatformType
  gazelleEnrich?: boolean
}): CredentialForm {
  const form: CredentialForm = CREDENTIAL_FORMS[entry.platform]
  return entry.gazelleEnrich ? { ...form, hidesJoinDate: true } : form
}

/**
 * For a stored row. The column is unconstrained and a backup restore can carry
 * a platform this build does not know, so an unknown value gets the plain
 * token form rather than a crash.
 */
export function credentialFormForPlatform(platform: string): CredentialForm {
  // hasOwn, not `??`: "constructor" or "__proto__" would resolve to an
  // inherited function and skip the fallback.
  if (!Object.hasOwn(CREDENTIAL_FORMS, platform)) return CREDENTIAL_FORMS.custom
  return CREDENTIAL_FORMS[platform as PlatformType]
}

// ---------------------------------------------------------------------------
// Validation and blob building
// ---------------------------------------------------------------------------

const UID_COOKIE = /(?:^|;\s*)uid=([^;]+)/
const PASS_COOKIE = /(?:^|;\s*)pass=([^;]+)/
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char check
const CONTROL_CHAR = /[\x00-\x1F\x7F]/
// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional byte-range check
const NON_LATIN1 = /[^\x00-\xFF]/

/** Same normalization the adapters apply, so the stored value round-trips. */
function cleanCookies(cookies: string): string {
  return cookies.trim().replace(/^Cookie:\s*/i, "")
}

function checkCookies(
  form: Extract<CredentialForm, { kind: CookieKind }>,
  cookies: string
): string | null {
  if (!cookies.trim()) return "Browser cookies are required"
  try {
    validateCookieHeader(cookies, {
      extraCookieNames: form.extraCookieNames,
      example: form.example,
    })
    return null
  } catch (error) {
    return error instanceof Error ? error.message : "Cookie string doesn't look right"
  }
}

/** The first thing wrong with what the user typed, or null. */
export function validateCredentialValues(
  form: CredentialForm,
  values: CredentialValues
): string | null {
  switch (form.kind) {
    case "token": {
      const token = values.token.trim()
      if (!token) return "API token is required"
      // The token goes into a request header, where a control character makes
      // undici throw a TypeError naming the whole header, which
      // classifyFetchError flattens to something the user cannot act on.
      if (CONTROL_CHAR.test(token)) {
        return "API token contains a control character. Re-copy the token with no surrounding text."
      }
      return null
    }
    case "cookies":
      return checkCookies(form, values.cookies)
    case "cookies-username":
      if (!values.username.trim()) return "Username is required"
      return checkCookies(form, values.cookies)
    case "uid-pass": {
      const trimmed = values.cookies.trim()
      if (!trimmed) return "Session cookies are required"
      if (!UID_COOKIE.test(trimmed)) {
        return "Cookie string is missing uid value. Paste the full Cookie header from DevTools."
      }
      if (!PASS_COOKIE.test(trimmed)) {
        return "Cookie string is missing pass value. Paste the full Cookie header from DevTools."
      }
      // What the DigitalCore adapter rejects once uid and pass are split out.
      // Its third guard, the semicolon, cannot fire here: UID_COOKIE and
      // PASS_COOKIE stop at the first one.
      if (CONTROL_CHAR.test(trimmed)) {
        return "Cookie values contain a control character. Paste the full Cookie header from DevTools."
      }
      if (NON_LATIN1.test(trimmed)) {
        return "Cookie values contain a non-ASCII character, usually a truncation mark. Re-copy the full Cookie header from DevTools."
      }
      return null
    }
    case "login":
      if (!values.username.trim()) return "Username is required"
      if (!values.password) return "Password is required"
      return null
  }
}

/**
 * The stored credential in the exact shape the adapter's parseCredentialJson
 * expects; a renamed or dropped key breaks polling for existing trackers.
 * `userAgent` is the submitting browser's, because the cookie trackers
 * fingerprint the session against the agent it was issued to.
 */
export function buildCredentialBlob(
  form: CredentialForm,
  values: CredentialValues,
  userAgent: string
): string {
  switch (form.kind) {
    case "token":
      return values.token.trim()
    case "cookies":
      return JSON.stringify({ cookies: cleanCookies(values.cookies), userAgent })
    case "cookies-username":
      return JSON.stringify({
        cookies: cleanCookies(values.cookies),
        userAgent,
        username: values.username.trim(),
      })
    case "uid-pass": {
      // The stored blob never reaches the client, so a rebuild here cannot
      // preserve an existing UA. Omitting the capture reverts the tracker to
      // the server default.
      const trimmed = values.cookies.trim()
      return JSON.stringify({
        uid: trimmed.match(UID_COOKIE)?.[1]?.trim() ?? "",
        pass: trimmed.match(PASS_COOKIE)?.[1]?.trim() ?? "",
        userAgent,
      })
    }
    case "login": {
      const alt2FAToken = values.alt2FAToken.trim()
      return JSON.stringify({
        username: values.username.trim(),
        // Never trimmed: leading or trailing spaces are part of the secret.
        password: values.password,
        // Absent, not empty, for accounts without 2FA, so their stored blob
        // stays the shape it has always been.
        ...(alt2FAToken ? { alt2FAToken } : {}),
      })
    }
  }
}
