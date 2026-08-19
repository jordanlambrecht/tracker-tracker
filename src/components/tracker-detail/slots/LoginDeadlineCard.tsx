// src/components/tracker-detail/slots/LoginDeadlineCard.tsx
//
// Functions: LoginDeadlineCard
//
// The login-deadline countdown ring plus a "Login Now" action. Trackers prune
// or disable accounts after `rules.loginIntervalDays` of inactivity, so the
// card counting that deadline down is also where the user acts on it.
//
// The action is layered on here rather than added to StatCard's ring variant
// because StatCard is shared: dashboard/LoginTimers wraps an entire ring card
// in an anchor, and an interactive element inside the card would nest anchors
// there.

import clsx from "clsx"
import { buttonVariants } from "@/components/ui/Button"
import { ExternalLinkSmallIcon } from "@/components/ui/Icons"
import type { StatCardRingProps } from "@/components/ui/StatCard"
import { StatCard } from "@/components/ui/StatCard"

export interface LoginDeadlineCardProps extends StatCardRingProps {
  /**
   * Destination for the "Login Now" button. The tracker's configured base
   * URL. Omitted rather than rendered dead when the tracker has no URL.
   */
  loginUrl?: string
}

export function LoginDeadlineCard({ loginUrl, className, ...ringProps }: LoginDeadlineCardProps) {
  // StatCard's ring variant renders nothing when the date can't be parsed.
  // Bail the same way so the action button never renders on its own.
  if (Number.isNaN(new Date(ringProps.lastAccessAt).getTime())) return null

  return (
    <div className="relative h-full">
      {/* pb-16 reserves room for the absolutely-positioned action below */}
      <StatCard {...ringProps} className={clsx("h-full", loginUrl && "pb-16", className)} />
      {loginUrl && (
        <a
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "absolute bottom-4 left-4 right-4 rounded-nm-sm"
          )}
        >
          Login Now
          <span className="sr-only"> (opens in a new tab)</span>
          <ExternalLinkSmallIcon width="12" height="12" />
        </a>
      )}
    </div>
  )
}
