// src/components/CredentialFields.tsx
"use client"

import { AreaInput } from "@/components/ui/AreaInput"
import { Input } from "@/components/ui/Input"
import { Notice } from "@/components/ui/Notice"
import { DOCS } from "@/lib/constants"
import {
  type CredentialFieldCopy,
  type CredentialForm,
  type CredentialValues,
  resolveFieldLabel,
} from "@/lib/credential-forms"

/** Which component is rendering. It selects the copy block and the id prefix. */
export type CredentialSurface = "dialog" | "sheet"

const ID_PREFIX: Record<CredentialSurface, string> = { dialog: "tracker", sheet: "edit" }

interface CredentialFieldsProps {
  form: CredentialForm
  values: CredentialValues
  onChange: (field: keyof CredentialValues, value: string) => void
  error?: string
  surface: CredentialSurface
  /** Fills a label that names the tracker. Only the AvistaZ network uses it. */
  trackerName?: string
}

function CredentialFields({
  form,
  values,
  onChange,
  error,
  surface,
  trackerName = "",
}: CredentialFieldsProps) {
  const copy = surface === "dialog" ? form.dialog : form.sheet
  const prefix = ID_PREFIX[surface]

  // Autofill is suppressed on every field: a password manager offering the
  // user's own login here would fill the wrong site's credential.
  const shared = { autoComplete: "off", "data-1p-ignore": true } as const

  function field(part: CredentialFieldCopy | undefined, id: string) {
    return {
      ...shared,
      id: `${prefix}-${id}`,
      name: `${prefix}-${id}`,
      label: resolveFieldLabel(part?.label, trackerName),
      placeholder: part?.placeholder,
      tooltip: part?.tooltip,
      docs: part?.docs ? DOCS.ADDING_A_TRACKER : undefined,
    }
  }

  if (form.kind === "token") {
    return (
      <Input
        {...field(copy.secret, "api-token")}
        type="password"
        value={values.token}
        onChange={(e) => onChange("token", e.target.value)}
        error={error}
      />
    )
  }

  if (form.kind === "login") {
    return (
      <>
        <Input
          {...field(copy.username, "username")}
          value={values.username}
          onChange={(e) => onChange("username", e.target.value)}
        />
        <Input
          {...field(copy.password, "password")}
          type="password"
          value={values.password}
          onChange={(e) => onChange("password", e.target.value)}
          error={error}
        />
        <Input
          {...field(copy.alt2FA, "alt2fa")}
          type="password"
          value={values.alt2FAToken}
          onChange={(e) => onChange("alt2FAToken", e.target.value)}
        />
      </>
    )
  }

  return (
    <>
      {form.kind === "cookies-username" && (
        <Input
          {...field(copy.username, "username")}
          value={values.username}
          onChange={(e) => onChange("username", e.target.value)}
        />
      )}
      <div className="flex flex-col gap-1">
        <AreaInput
          {...field(copy.secret, "cookies")}
          value={values.cookies}
          onChange={(e) => onChange("cookies", e.target.value)}
          rows={copy.secret?.rows}
        />
        {copy.secret?.warnsOnTruncation && values.cookies.includes("…") && (
          <Notice variant="warn">
            Cookie string appears truncated (contains &quot;&hellip;&quot;). Firefox truncates long
            values in the display. Right-click the Cookie header and select{" "}
            <strong>Copy Value</strong> instead.
          </Notice>
        )}
        <Notice message={error} />
      </div>
    </>
  )
}

export { CredentialFields }
