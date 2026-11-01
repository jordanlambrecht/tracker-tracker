// src/components/settings/AboutSection.tsx
//
// Functions: AboutSection

import { Paragraph, Subheader } from "@typography"
import clsx from "clsx"
import Image from "next/image"
import type { ReactNode } from "react"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { HeartIcon, PillTag } from "@/components/ui"
import { DOCS_URL } from "@/lib/constants"

const REPO_URL = "https://github.com/jordanlambrecht/tracker-tracker"
const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
const GITHUB_SPONSORS_URL = "https://github.com/sponsors/jordanlambrecht"
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/jordyjordy"

/** Inline link treatment shared by every link in this card, so no single one reads louder. */
const LINK_CLASS = "text-accent hover:underline"

/**
 * The sponsor buttons are the one place this card is not plain links. Both are
 * 40px tall and use Button's focus ring, so keyboard focus shows on the image
 * button as well as the drawn one. The Buy Me a Coffee artwork is their
 * standard yellow button, stored under public/img/sponsor so nothing loads
 * from a third party.
 */
const SPONSOR_LINK_CLASS =
  "inline-flex h-10 items-center rounded-nm-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-control-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-base"

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

      <Paragraph>Tracker Tracker is free and independently maintained.</Paragraph>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={GITHUB_SPONSORS_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub Sponsors"
          className={clsx(
            SPONSOR_LINK_CLASS,
            "gap-2 border border-border-emphasis bg-control-bg px-4 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-raised"
          )}
        >
          <HeartIcon width="16" height="16" className="shrink-0 text-[#db61a2]" />
          Sponsor
        </a>
        <a
          href={BUY_ME_A_COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={SPONSOR_LINK_CLASS}
        >
          <Image
            src="/img/sponsor/bmc-button.png"
            alt="Buy Me a Coffee"
            width={142}
            height={40}
            unoptimized
            className="h-10 w-auto rounded-nm-md"
          />
        </a>
      </div>
    </SettingsSection>
  )
}
