// src/test/setup.ts
import "@testing-library/jest-dom/vitest"

// Prevent pino from trying to write to /data/logs/ during tests
process.env.LOG_FILE = ""

// jsdom implements <dialog> but not showModal()/close(), so any component built on
// the native dialog element (see components/ui/Dialog.tsx) throws on render and the
// whole subtree silently disappears. Stub them so dialogs are testable at all.
// Both stubs are IDEMPOTENT, and that is load-bearing rather than tidiness. Dialog
// closes itself from a transition-end handler, and its onClose sets state that
// re-renders and closes again. A close() that fires its event unconditionally turns
// that into a feedback loop: measured on DashboardChartPreferences.test.tsx, a
// naive stub took the file from 19s/4-passing to 90s/3-failing purely on timeouts.
// Guarding on the current state ends the cycle after one pass.
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      if (this.open) return
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      if (!this.open) return
      this.open = false
      this.dispatchEvent(new Event("close"))
    }
  }
}
