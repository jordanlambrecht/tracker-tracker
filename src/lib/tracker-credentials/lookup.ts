// src/lib/tracker-credentials/lookup.ts
//
// Functions: findCredentialValue

import type { TrackerCredentialVault } from "@/lib/tracker-credentials/types"

export function findCredentialValue(vault: TrackerCredentialVault, fieldId: string): string | null {
  for (const section of vault.sections) {
    for (const field of section.fields) {
      if (field.id === fieldId && field.value.trim()) return field.value.trim()
    }
  }
  return null
}
