// src/lib/tracker-platforms/helpers/errors.ts
//
// Classes: SessionExpiredError, CredentialsRejectedError

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

/**
 * A login failed because the stored username or password is wrong. The tracker
 * is then paused at once instead of after repeated failures, because some
 * trackers ban an IP address after a few failed logins.
 */
export class CredentialsRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CredentialsRejectedError"
  }
}
