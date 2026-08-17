// src/components/settings/AboutSection.tsx
//
// Functions: AboutSection

import { Paragraph, Subheader } from "@typography"
import type { ReactNode } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { PillTag } from "@/components/ui"
import { DOCS_URL } from "@/lib/constants"

const REPO_URL = "https://github.com/jordanlambrecht/tracker-tracker"
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
const GITHUB_SPONSORS_URL = "https://github.com/sponsors/jordanlambrecht"
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/jordyjordy"

/** Inline link treatment shared by every link in this card, so no single one reads louder. */
const LINK_CLASS = "text-accent hover:underline"

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {children}
    </a>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Subheader>{label}</Subheader>
      <span className="text-xs font-mono text-tertiary flex items-center gap-2">{children}</span>
    </div>
  )
}

export function AboutSection() {
  return (
    <SettingsSection id="about" title="About" cardClassName="flex flex-col gap-4">
      <Row label="Version">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
        {process.env.NEXT_PUBLIC_RELEASE_CHANNEL === "development" && (
          <PillTag color="warn" size="md" label="dev" />
        )}
      </Row>

      <Row label="Repository">
        <ExternalLink href={REPO_URL}>jordanlambrecht/tracker-tracker</ExternalLink>
      </Row>

      <Row label="Documentation">
        <ExternalLink href={DOCS_URL}>jordanlambrecht.github.io/tracker-tracker</ExternalLink>
      </Row>

      <Row label="License">
        <ExternalLink href={LICENSE_URL}>GPL-3.0</ExternalLink>
      </Row>

      <div className="border-t border-border" />

      <Paragraph>
        Tracker Tracker is free and independently maintained.{" "}
        <ExternalLink href={GITHUB_SPONSORS_URL}>GitHub Sponsors</ExternalLink> for recurring
        support, <ExternalLink href={BUY_ME_A_COFFEE_URL}>Buy Me a Coffee</ExternalLink> for a
        one-off.
      </Paragraph>
    </SettingsSection>
  )
}
