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
 * A login was refused because the stored username or password is wrong, as
 * opposed to a network or page failure. Callers recognise it by type.
 */
export class CredentialsRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CredentialsRejectedError"
  }
}
