// src/lib/clipboard.ts
//
// Functions: copyTextToClipboard
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NOT JUST navigator.clipboard.writeText
//
// `navigator.clipboard` is gated on a SECURE CONTEXT. On plain HTTP it is
// `undefined` on every browser except at localhost — and this app is routinely
// self-hosted on a LAN at http://192.168.x.x:3000, which is exactly the case the
// spec excludes. A copy button wired straight to the Clipboard API therefore
// does nothing at all for a large share of this project's users, and the old
// `.catch(() => {})` in ActionButtons made that failure completely silent.
//
// So: try the modern API, fall back to the legacy `document.execCommand("copy")`
// (deprecated, but still implemented everywhere and NOT secure-context gated),
// and if both fail SAY SO rather than pretending. The caller is expected to
// surface "unavailable" to the user — a button that silently does nothing is
// worse than no button, because the user believes they have the secret on their
// clipboard and pastes whatever was there before.
// ─────────────────────────────────────────────────────────────────────────────

export type ClipboardOutcome = "copied" | "unavailable"

/**
 * Legacy path. Requires the text to be selected inside a real, focusable node,
 * so a throwaway textarea is mounted off-screen, selected, copied and removed
 * synchronously within this one call.
 *
 * The plaintext is in the DOM for the duration of that call. That is a real
 * (if brief) exposure and it is unavoidable for this API — it is also why this
 * is the FALLBACK and not the primary path.
 */
function copyViaExecCommand(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false

  const previouslyFocused = document.activeElement as HTMLElement | null
  const textarea = document.createElement("textarea")
  textarea.value = text
  // readOnly stops the mobile keyboard appearing; the off-screen fixed position
  // stops the page scrolling to the element when it takes focus.
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "0"
  textarea.style.left = "-9999px"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)

  let copied = false
  try {
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    copied = document.execCommand("copy")
  } catch {
    copied = false
  } finally {
    textarea.remove()
    // Focus was stolen from whatever the user clicked. Give it back, or the next
    // Tab press starts from the top of the document.
    previouslyFocused?.focus?.()
  }
  return copied
}

/**
 * Copy `text`, trying every route available in this context.
 *
 * Never throws and never rejects: the outcome is the return value, so a caller
 * cannot accidentally swallow a failure in a `.catch`.
 *
 * Note the Clipboard API can also reject AFTER an await — Safari in particular
 * treats a write that follows a network round trip as outside the user gesture.
 * That rejection lands on the execCommand fallback below rather than on the
 * user, which is the main reason the ladder is ordered this way.
 */
export async function copyTextToClipboard(text: string): Promise<ClipboardOutcome> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return "copied"
    }
  } catch {
    // Permission denied, insecure context, or a lost user gesture. Fall through
    // — deliberately not rethrown, because there is still one route left to try.
  }

  return copyViaExecCommand(text) ? "copied" : "unavailable"
}
