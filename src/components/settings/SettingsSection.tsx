// src/components/settings/SettingsSection.tsx
//
// Functions: SettingsSection

import { H2 } from "@typography"
import type { ReactNode } from "react"
import { Card } from "@/components/ui/Card"
import { Tooltip } from "@/components/ui/Tooltip"

interface SettingsSectionProps {
  id: string
  title: string
  tooltip?: string
  docs?: { href: string; description?: string }
  headingClassName?: string
  cardClassName?: string
  notice?: { label: string; message: string }
  children: ReactNode
}

export function SettingsSection({
  id,
  title,
  tooltip,
  docs,
  headingClassName,
  cardClassName,
  notice,
  children,
}: SettingsSectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <H2
        id={`${id}-heading`}
        className={`mb-4 flex items-center gap-2 ${headingClassName ?? ""}`}
      >
        {title}
        {tooltip && (
          <Tooltip content={tooltip} docs={docs}>
            <span className="text-muted hover:text-secondary cursor-help text-sm">&#9432;</span>
          </Tooltip>
        )}
      </H2>
      {notice && (
        <div className="nm-inset-sm rounded-nm-md px-4 py-3 mb-4 border border-warn/20 bg-warn/5">
          <span className="text-xs text-warn font-medium">{notice.label}</span>
          <p className="text-xs text-secondary mt-1">{notice.message}</p>
        </div>
      )}
      <Card elevation="raised" className={cardClassName}>
        {children}
      </Card>
    </section>
  )
}
