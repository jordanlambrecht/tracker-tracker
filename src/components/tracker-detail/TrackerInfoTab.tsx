// src/components/tracker-detail/TrackerInfoTab.tsx
//
// Functions: TrackerInfoTab

"use client"

import { H2 } from "@typography"
import clsx from "clsx"
import { useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChevronToggle } from "@/components/ui/ChevronToggle"
import { Tooltip } from "@/components/ui/Tooltip"
import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/formatters"
import type { TrackerLatestStats } from "@/types/api"

interface TrackerInfoTabProps {
  registryEntry: TrackerRegistryEntry | undefined
  stats: TrackerLatestStats | null
  accentColor: string
}

export function TrackerInfoTab({ registryEntry, stats, accentColor: tc }: TrackerInfoTabProps) {
  const [bannedOpen, setBannedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-10">
      {/* Description */}
      {registryEntry?.description && (
        <div className="flex flex-col gap-2">
          <H2>About</H2>
          <p className="text-sm font-sans text-secondary leading-relaxed max-w-prose">
            {registryEntry.description}
          </p>
          {registryEntry.specialty && (
            <p className="text-xs font-mono text-muted mt-1">
              Specialty: {registryEntry.specialty}
            </p>
          )}
        </div>
      )}

      {/* Key Rules */}
      {registryEntry?.rules && (
        <div className="flex flex-col gap-3">
          <H2>Key Rules</H2>
          <div className="nm-inset-sm bg-control-bg overflow-hidden rounded-nm-md">
            {[
              {
                label: "Minimum Ratio",
                value:
                  registryEntry.rules.minimumRatio > 0
                    ? registryEntry.rules.minimumRatio.toString()
                    : "None",
                tip: "Your upload/download ratio must stay above this threshold to avoid demotion or account restrictions.",
              },
              {
                label: "Seed Time",
                value:
                  registryEntry.rules.seedTimeHours > 0
                    ? registryEntry.rules.seedTimeHours % 24 === 0
                      ? `${registryEntry.rules.seedTimeHours / 24} days`
                      : `${registryEntry.rules.seedTimeHours} hours`
                    : "None",
                tip: "The minimum amount of time you must seed each torrent after downloading it.",
              },
              {
                label: "Fulfillment Period",
                value:
                  registryEntry.rules.fulfillmentPeriodHours != null
                    ? registryEntry.rules.fulfillmentPeriodHours % 24 === 0
                      ? `${registryEntry.rules.fulfillmentPeriodHours / 24} days`
                      : `${registryEntry.rules.fulfillmentPeriodHours} hours`
                    : null,
                tip: "The total window you have to complete the required seed time. Seeding doesn't have to be continuous, but must be met within this period.",
              },
              {
                label: "Login Interval",
                value: `${registryEntry.rules.loginIntervalDays} days`,
                tip: "How long you can go without logging in before your account is parked, pruned, or disabled.",
              },
              {
                label: "H&R Ban Limit",
                value:
                  registryEntry.rules.hnrBanLimit != null
                    ? `${registryEntry.rules.hnrBanLimit} warnings`
                    : null,
                tip: "The number of Hit & Run violations allowed before your account is banned or download privileges are revoked.",
              },
            ]
              .filter((r) => r.value != null)
              .map((rule, i) => (
                <div
                  key={rule.label}
                  className={clsx(
                    "flex items-center justify-between px-5 py-3.5",
                    i > 0 ? "border-t border-border" : ""
                  )}
                >
                  <span className="text-sm font-sans text-tertiary flex items-center gap-1.5">
                    {rule.label}
                    <Tooltip content={rule.tip}>
                      <span className="cursor-help text-[9px] font-bold opacity-50 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current hover:opacity-80 transition-opacity">
                        ?
                      </span>
                    </Tooltip>
                  </span>
                  <span className="text-base font-mono font-semibold text-primary">
                    {rule.value}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Content categories */}
      {registryEntry?.contentCategories && registryEntry.contentCategories.length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>Content</H2>
          <div className="flex flex-wrap items-center gap-2">
            {registryEntry.contentCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center px-3 py-1 font-mono text-xs text-tertiary nm-inset-sm bg-control-bg rounded-nm-pill"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {registryEntry?.stats &&
        (registryEntry.stats.userCount || registryEntry.stats.torrentCount) && (
          <div className="flex flex-col gap-3">
            <H2>Site Stats</H2>
            {registryEntry.stats.statsUpdatedAt && (
              <span className="text-[10px] font-mono text-muted">
                Updated {registryEntry.stats.statsUpdatedAt}
              </span>
            )}
            <div className="flex flex-wrap gap-6">
              {registryEntry.stats.userCount != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-mono font-semibold text-primary">
                    {registryEntry.stats.userCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-sans text-tertiary">
                    Users
                    {registryEntry.stats.activeUsers != null && (
                      <span className="text-muted ml-1">
                        ({registryEntry.stats.activeUsers.toLocaleString()} active)
                      </span>
                    )}
                  </span>
                </div>
              )}
              {registryEntry.stats.torrentCount != null && (
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-mono font-semibold text-primary">
                    {registryEntry.stats.torrentCount.toLocaleString()}
                  </span>
                  <span className="text-xs font-sans text-tertiary">Torrents</span>
                </div>
              )}
              {registryEntry.stats.seedSize && (
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-mono font-semibold text-primary">
                    {registryEntry.stats.seedSize}
                  </span>
                  <span className="text-xs font-sans text-tertiary">Seed Size</span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* User Ranks */}
      {registryEntry?.userClasses && registryEntry.userClasses.length > 0 && (
        <div className="flex flex-col gap-3">
          <H2>User Ranks</H2>
          <div className="nm-inset-sm bg-control-bg overflow-hidden rounded-nm-md">
            {registryEntry.userClasses.map((uc, i) => {
              const isCurrent = stats?.group?.toLowerCase() === uc.name.toLowerCase()
              return (
                <div
                  key={uc.name}
                  className={clsx(
                    "flex items-start justify-between px-6 py-3.5",
                    i > 0 ? "border-t border-border" : ""
                  )}
                  style={isCurrent ? { backgroundColor: hexToRgba(tc, 0.08) } : undefined}
                >
                  <div className="flex items-center gap-3 pt-0.5">
                    <span
                      className={clsx(
                        "text-sm font-mono min-w-[140px]",
                        isCurrent ? "font-semibold" : "text-secondary"
                      )}
                      style={isCurrent ? { color: tc } : undefined}
                    >
                      {uc.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-mono" style={{ color: tc }}>
                        ← you
                      </span>
                    )}
                  </div>
                  {(uc.requirements || (uc.perks && uc.perks.length > 0)) && (
                    <div className="flex flex-col items-end gap-1 max-w-[60%]">
                      {uc.requirements && (
                        <span className="text-xs font-mono text-muted text-right">
                          {uc.requirements}
                        </span>
                      )}
                      {uc.perks && uc.perks.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1 mt-1">
                          {uc.perks.map((perk) => (
                            <span
                              key={`${perk.type}-${perk.label}`}
                              className="text-[10px] font-mono text-muted nm-inset-sm bg-control-bg px-1.5 py-0.5 rounded-nm-pill"
                            >
                              {perk.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Release Groups */}
      {registryEntry?.releaseGroups && registryEntry.releaseGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>Release Groups</H2>
          <div className="flex flex-wrap gap-2">
            {registryEntry.releaseGroups.map((g) => {
              const name = typeof g === "string" ? g : g.name
              const desc = typeof g === "string" ? undefined : g.description
              const badge = (
                <span
                  key={name}
                  className="nm-inset-sm bg-control-bg rounded-nm-pill px-3 py-1 text-xs font-mono text-accent"
                >
                  {name}
                </span>
              )
              return desc ? (
                <Tooltip key={name} content={desc}>
                  {badge}
                </Tooltip>
              ) : (
                badge
              )
            })}
          </div>
        </div>
      )}

      {/* Notable Members */}
      {registryEntry?.notableMembers && registryEntry.notableMembers.length > 0 && (
        <div className="flex flex-col gap-2">
          <H2>Notable Members</H2>
          <div className="flex flex-wrap gap-2">
            {registryEntry.notableMembers.map((m) => (
              <span
                key={m}
                className="nm-inset-sm bg-control-bg rounded-nm-pill px-3 py-1 text-xs font-mono text-secondary"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Banned Groups (accordion) */}
      {registryEntry?.bannedGroups && registryEntry.bannedGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center gap-2 text-xs font-sans font-medium text-tertiary uppercase tracking-wider cursor-pointer hover:text-secondary transition-colors"
            onClick={() => setBannedOpen((o) => !o)}
          >
            <ChevronToggle expanded={bannedOpen} />
            Banned Groups
            <span className="text-muted font-mono normal-case">
              ({registryEntry.bannedGroups.length})
            </span>
          </button>
          {bannedOpen && (
            <div className="flex flex-wrap gap-2">
              {registryEntry.bannedGroups.map((g) => (
                <span
                  key={g}
                  className="nm-inset-sm bg-control-bg rounded-nm-pill px-3 py-1 text-xs font-mono text-danger"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Rules */}
      {registryEntry?.rules?.fullRulesMarkdown && (
        <div className="flex flex-col gap-3">
          <H2>Full Rules</H2>
          <div className="nm-inset-sm bg-control-bg px-5 py-4 text-sm font-sans text-secondary leading-relaxed rounded-nm-md prose prose-invert prose-sm max-w-none prose-headings:text-primary prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-table:w-full prose-th:text-left prose-th:py-2 prose-th:px-3 prose-th:text-xs prose-th:font-mono prose-th:uppercase prose-th:tracking-wider prose-th:text-tertiary prose-td:py-2 prose-td:px-3 prose-td:font-mono prose-td:text-sm prose-strong:text-primary prose-li:marker:text-muted">
            <Markdown remarkPlugins={[remarkGfm]}>
              {registryEntry.rules.fullRulesMarkdown.join("\n").replace(/\*\*(\d+)\.\*\*/g, "$1.")}
            </Markdown>
          </div>
        </div>
      )}
    </div>
  )
}
