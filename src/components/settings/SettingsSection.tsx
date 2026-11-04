// src/components/settings/SettingsSection.tsx

import type { ReactNode } from "react"
import {
  SettingsSectionHeading,
  settingsHeadingId,
} from "@/components/settings/SettingsSectionHeading"
import { Card } from "@/components/ui/Card"
import { Notice } from "@/components/ui/Notice"

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
    <section aria-labelledby={settingsHeadingId(id)}>
      <SettingsSectionHeading
        id={id}
        title={title}
        tooltip={tooltip}
        docs={docs}
        className="mb-4"
        headingClassName={headingClassName}
      />
      {notice && (
        <div className="mb-4">
          <Notice variant="warn" box header={notice.label} message={notice.message} />
        </div>
      )}
      <Card elevation="raised" className={cardClassName}>
        {children}
      </Card>
    </section>
  )
}
