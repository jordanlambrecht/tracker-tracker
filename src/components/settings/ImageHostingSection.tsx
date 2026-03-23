// src/components/settings/ImageHostingSection.tsx
//
// Functions: ImageHostingSection

"use client"

import { useState } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { usePatchSettings } from "@/hooks/usePatchSettings"
import { DOCS } from "@/lib/constants"

const IMAGE_HOSTS = [
  {
    key: "ptpimg" as const,
    label: "PTPImg",
    field: "ptpimgApiKey",
    description: "ptpimg.me — required by PTP, accepted by most trackers.",
  },
  {
    key: "oeimg" as const,
    label: "OnlyImage",
    field: "oeimgApiKey",
    description: "onlyimage.org — used by OnlyEncodes and other trackers.",
  },
  {
    key: "imgbb" as const,
    label: "ImgBB",
    field: "imgbbApiKey",
    description: "imgbb.com — widely accepted free image host.",
  },
] as const

interface ImageHostingSectionProps {
  initialHasKeys: {
    ptpimg: boolean
    oeimg: boolean
    imgbb: boolean
  }
}

export function ImageHostingSection({ initialHasKeys }: ImageHostingSectionProps) {
  const [hasKeys, setHasKeys] = useState(initialHasKeys)
  const [values, setValues] = useState<Record<string, string>>({
    ptpimgApiKey: "",
    oeimgApiKey: "",
    imgbbApiKey: "",
  })
  const [editing, setEditing] = useState<Record<string, boolean>>({})

  const { saving, error, success, patch, clearSuccess } = usePatchSettings()

  async function handleSave(field: string, hostKey: "ptpimg" | "oeimg" | "imgbb") {
    clearSuccess()
    const result = await patch({ [field]: values[field] })
    if (result !== null) {
      setHasKeys((prev) => ({ ...prev, [hostKey]: !!values[field] }))
      setValues((prev) => ({ ...prev, [field]: "" }))
      setEditing((prev) => ({ ...prev, [hostKey]: false }))
    }
  }

  async function handleClear(field: string, hostKey: "ptpimg" | "oeimg" | "imgbb") {
    clearSuccess()
    const result = await patch({ [field]: null })
    if (result !== null) {
      setHasKeys((prev) => ({ ...prev, [hostKey]: false }))
      setValues((prev) => ({ ...prev, [field]: "" }))
      setEditing((prev) => ({ ...prev, [hostKey]: false }))
    }
  }

  return (
    <SettingsSection
      id="image-hosting"
      title="Image Hosting"
      tooltip="Upload screenshots to approved image hosts."
      docs={DOCS.IMAGE_HOSTING}
      notice={{
        label: "Coming Soon",
        message:
          "Image hosting is being set up independently. It will be integrated with Transit Papers and tracker screenshot uploads in a future update. For now, you can configure your API keys here so they're ready when the feature launches.",
      }}
      cardClassName="flex flex-col gap-6"
    >
      {IMAGE_HOSTS.map((host) => {
        const isEditing = editing[host.key]
        const hasKey = hasKeys[host.key]

        return (
          <div key={host.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-mono font-semibold text-primary">{host.label}</span>
                <p className="text-xs font-sans text-secondary mt-0.5">{host.description}</p>
              </div>
              {hasKey && !isEditing && (
                <span className="text-xs font-mono text-success nm-inset-sm px-2 py-1 rounded-nm-sm">
                  configured
                </span>
              )}
            </div>

            {isEditing || !hasKey ? (
              <div className="flex flex-col gap-2">
                <Input
                  type="password"
                  placeholder="Paste API key"
                  value={values[host.field]}
                  onChange={(e) => {
                    setValues((prev) => ({ ...prev, [host.field]: e.target.value }))
                    clearSuccess()
                  }}
                  data-1p-ignore
                  autoComplete="off"
                />
                <div className="flex gap-2 justify-end">
                  {(hasKey || isEditing) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing((prev) => ({ ...prev, [host.key]: false }))
                        setValues((prev) => ({ ...prev, [host.field]: "" }))
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={saving || !values[host.field]}
                    onClick={() => handleSave(host.field, host.key)}
                  >
                    {saving ? "Saving…" : "Save Key"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditing((prev) => ({ ...prev, [host.key]: true }))}
                >
                  Replace Key
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => handleClear(host.field, host.key)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {error && (
        <p className="text-xs font-sans text-danger" role="alert">
          {error}
        </p>
      )}
      {success && <p className="text-xs font-sans text-success">Image hosting key saved.</p>}
    </SettingsSection>
  )
}
