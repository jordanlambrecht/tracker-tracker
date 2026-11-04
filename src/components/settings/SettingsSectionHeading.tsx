// src/components/settings/SettingsSectionHeading.tsx

import { H2, Paragraph } from "@typography"
import clsx from "clsx"
import type { ReactNode } from "react"
import { InfoTip } from "@/components/ui/InfoTip"
import type { DocsEntry } from "@/lib/constants"

/** The id of a settings section's heading, which the section is labelled by. */
export function settingsHeadingId(id: string): string {
  return `${id}-heading`
}

interface SettingsSectionHeadingProps {
  id: string
  title: string
  tooltip?: string
  docs?: DocsEntry
  /** A line under the title. */
  description?: ReactNode
  /** A control at the end of the title row. */
  action?: ReactNode
  /** Spacing around the whole heading. */
  className?: string
  headingClassName?: string
}

export function SettingsSectionHeading({
  id,
  title,
  tooltip,
  docs,
  description,
  action,
  className,
  headingClassName,
}: SettingsSectionHeadingProps) {
  // A title with nothing beside or under it is the heading alone, spacing included.
  const bare = !description && !action
  const heading = (
    <H2
      id={settingsHeadingId(id)}
      className={clsx(bare && className, "flex items-center gap-2", headingClassName)}
    >
      {title}
      {tooltip && <InfoTip content={tooltip} docs={docs} />}
    </H2>
  )
  if (bare) return heading
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      {action ? (
        <div className="flex items-center justify-between">
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {description && <Paragraph>{description}</Paragraph>}
    </div>
  )
}
