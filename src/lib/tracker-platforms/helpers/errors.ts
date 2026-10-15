// src/lib/tracker-platforms/helpers/errors.ts
//
// Classes: SessionExpiredError

/**
 * An authenticated request came back as a login page, or was bounced to one.
 * Callers recognise it by type, so the message is free to change.
 */
export class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SessionExpiredError"
  }
}
