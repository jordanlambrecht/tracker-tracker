// src/test/setup.ts
import "@testing-library/jest-dom/vitest"

// Prevent pino from trying to write to /data/logs/ during tests
process.env.LOG_FILE = ""

// jsdom implements <dialog> but not showModal()/close(), so any component built on
// the native dialog element (see components/ui/Dialog.tsx) throws on render and the
// whole subtree silently disappears. Stub them so dialogs are testable at all.
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event("close"))
    }
  }
}
