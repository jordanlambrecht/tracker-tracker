// src/components/settings/TwoFactorSection.tsx
//
// Functions: TwoFactorSection

"use client"

import { SettingsSection } from "@/components/settings/SettingsSection"
import { TwoFactorSetup } from "@/components/TwoFactorSetup"
import { DOCS } from "@/lib/constants"

export function TwoFactorSection() {
  return (
    <SettingsSection
      id="two-factor"
      title="Two-Factor Authentication"
      tooltip="Protect your login with a TOTP authenticator app."
      docs={DOCS.TOTP}
    >
      <TwoFactorSetup />
    </SettingsSection>
  )
}
