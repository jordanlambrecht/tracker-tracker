// src/components/settings/CredentialVaultSection.tsx
//
// The opt-in gate's Settings half. The credential sheet links straight here when
// the feature is off, so the anchor this section renders is part of the
// contract, not decoration:
//
//   SettingsSection puts its id on the HEADING as `${id}-heading`, so this
//   section is reachable at /settings#credential-vault-heading. Renaming the id
//   silently breaks the sheet's "Enable in Settings" button. CredentialSheet
//   imports the href from here rather than spelling it out, and a test asserts
//   the element that href points at actually exists.

"use client"

import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Notice, Toggle } from "@/components/ui"
import { usePatchSettings } from "@/hooks/usePatchSettings"

/** The section's id. `SettingsSection` derives the heading's DOM id from it. */
export const CREDENTIAL_VAULT_SECTION_ID = "credential-vault"

/**
 * Deep link to this toggle, for the sheet's opt-in gate.
 *
 * Points at the HEADING rather than the switch itself so the browser scrolls the
 * section title into view with the control just below it, because landing on a bare
 * switch with its heading scrolled off the top tells the user nothing about what
 * they are about to turn on.
 *
 * Note this relies on the section living on the DEFAULT ("general") Settings
 * tab: tab state is plain React state with no URL sync, so an anchor into any
 * other tab would point at an element that is not mounted.
 */
export const CREDENTIAL_VAULT_SETTINGS_HREF = `/settings#${CREDENTIAL_VAULT_SECTION_ID}-heading`

export interface CredentialVaultSectionProps {
  initialEnabled: boolean
}

export function CredentialVaultSection({ initialEnabled }: CredentialVaultSectionProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const { saving, error, patch } = usePatchSettings()

  async function handleToggle(checked: boolean) {
    const result = await patch({ credentialVaultEnabled: checked })
    if (result.ok) {
      // Trust the server's echo rather than the optimistic value, because the PATCH
      // handler re-reads the row, so this is the state that actually persisted.
      setEnabled(
        Boolean((result.data as { credentialVaultEnabled?: boolean }).credentialVaultEnabled)
      )
    }
  }

  return (
    <SettingsSection
      id={CREDENTIAL_VAULT_SECTION_ID}
      title="Tracker Credentials"
      tooltip="Store the API keys, passkeys, IRC logins and announce URLs each tracker issues you, encrypted with your master password."
      cardClassName="flex flex-col gap-5"
    >
      <Toggle
        label="Store tracker credentials"
        checked={enabled}
        onChange={handleToggle}
        disabled={saving}
        description="Adds a Credentials panel to every tracker where you can keep API keys, passkeys, IRC logins and announce URLs. Values are encrypted with your master password and shown only when you ask for them."
      />

      {enabled ? (
        <Notice
          variant="info"
          message="Credentials are encrypted with the same key as your API tokens, so they are re-encrypted when you change your password and included in backups."
        />
      ) : (
        <Notice
          variant="info"
          // Says out loud that turning this off is not a delete, because otherwise the
          // only way to find out is to toggle it and hope.
          message="Turning this off hides the Credentials panel and blocks the API that reads it. Anything you have already stored is kept, stays encrypted, and reappears if you turn this back on."
        />
      )}

      <Notice message={error} />
    </SettingsSection>
  )
}
