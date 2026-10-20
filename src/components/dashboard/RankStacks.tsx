// src/components/dashboard/RankStacks.tsx
"use client"

import clsx from "clsx"
import { useRouter } from "next/navigation"
import { REDACTED_NOTE, RedactedText } from "@/components/ui/RedactedText"
import { SectionToggle } from "@/components/ui/SectionToggle"
import { Tooltip } from "@/components/ui/Tooltip"
import { registryEntryFor } from "@/data/tracker-registry"
import { hexToRgba } from "@/lib/color-utils"
import { isRedacted } from "@/lib/privacy"
import { buildRankLadder, type RankLadder } from "@/lib/rank-ladder"
import type { TrackerSummary } from "@/types/api"

// Every stack is the same height, so rung thickness is what varies with the
// ladder. The longest earned ladder in the registry is 11 rungs; at this
// height and gap each of those is still about 6px tall.
const STACK_CLASS = "flex flex-col-reverse gap-[2px] h-24 w-9"
const RUNG_CLASS = "flex-1 rounded-[2px] transition-colors duration-150"
const LIT_ALPHA = 0.45
const GHOST_ALPHA = 0.1
const GLOW = "0 0 8px"
const GLOW_ALPHA = 0.5

interface StackEntry {
  tracker: TrackerSummary
  ladder: RankLadder
}

interface RankStacksProps {
  trackers: TrackerSummary[]
  // Collapse state is owned by the parent's single useSectionCollapse instance,
  // for the same reason LoginTimers does not call the hook itself.
  expanded: boolean
  onToggleExpanded: () => void
}

// One tooltip per stack rather than per rung: a popup under a rung covered
// the rungs beneath it, and rung spans are not focusable, so this is also the
// only way the requirements reach keyboard users.
function RungList({ ladder, color }: { ladder: RankLadder; color: string }) {
  const { rungs, currentIndex, appointedClass, unknownClass, shownClass, summary } = ladder
  return (
    <span className="block w-56 max-h-[70vh] overflow-y-auto">
      {appointedClass && (
        <span className="block mb-1 font-semibold" style={{ color }}>
          {appointedClass}, above the ladder
        </span>
      )}
      {unknownClass && <span className="block mb-1 text-warn">{summary}</span>}
      {isRedacted(shownClass) && <span className="block mb-1 text-muted">{REDACTED_NOTE}</span>}
      {/* Highest first, mirroring the stack. A class above the ladder lights
          the top rung but is not that rung, so it gets no "(you)". */}
      {[...rungs].reverse().map((rung, i) => {
        const index = rungs.length - 1 - i
        const isCurrent = !appointedClass && index === currentIndex
        return (
          <span key={rung.name} className="block py-0.5">
            <span
              className={isCurrent ? "font-semibold" : "text-secondary"}
              style={isCurrent ? { color } : undefined}
            >
              {rung.name}
              {isCurrent ? " (you)" : ""}
            </span>
            {rung.requirements && <span className="block text-muted">{rung.requirements}</span>}
          </span>
        )
      })}
    </span>
  )
}

function RankStack({ tracker, ladder, onOpen }: StackEntry & { onOpen: () => void }) {
  const { rungs, currentIndex, unknownClass, shownClass, summary } = ladder
  const lit = currentIndex + 1

  return (
    <Tooltip className="inline-flex" content={<RungList ladder={ladder} color={tracker.color} />}>
      <button
        type="button"
        onClick={onOpen}
        // aria-label replaces the button's content as its accessible name, so
        // the class has to be repeated here or a screen reader never hears it.
        aria-label={`${tracker.name}: ${summary}`}
        className="flex flex-col items-center gap-2 w-28 px-3 py-3 nm-interactive-sm rounded-nm-md cursor-pointer bg-transparent border-none"
      >
        {/* DOM order is bottom-up, so the lowest class is the first child. */}
        <div className={STACK_CLASS}>
          {rungs.map((rung, i) => {
            const isCurrent = i === currentIndex
            const isLit = i < lit
            return (
              <span
                key={rung.name}
                data-rung={i}
                data-lit={isLit ? "true" : "false"}
                className={RUNG_CLASS}
                style={{
                  backgroundColor: hexToRgba(
                    tracker.color,
                    isLit ? (isCurrent ? 1 : LIT_ALPHA) : GHOST_ALPHA
                  ),
                  boxShadow: isCurrent
                    ? `${GLOW} ${hexToRgba(tracker.color, GLOW_ALPHA)}`
                    : undefined,
                }}
              />
            )
          })}
        </div>
        <span className="font-sans text-xs font-semibold text-primary truncate w-full text-center">
          {tracker.name}
        </span>
        <RedactedText
          value={shownClass}
          color={tracker.color}
          tooltip={false}
          className={clsx(
            "font-mono text-3xs truncate w-full text-center",
            unknownClass ? "text-warn" : "text-tertiary"
          )}
        />
      </button>
    </Tooltip>
  )
}

export function RankStacks({ trackers, expanded, onToggleExpanded }: RankStacksProps) {
  const router = useRouter()

  const entries: StackEntry[] = trackers.flatMap((tracker) => {
    if (!tracker.isActive) return []
    const classes = registryEntryFor(tracker)?.userClasses ?? []
    const ladder = buildRankLadder(classes, tracker.latestStats?.group)
    return ladder ? [{ tracker, ladder }] : []
  })

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <SectionToggle label="Ranks" expanded={expanded} onToggle={onToggleExpanded} />

      {expanded && (
        <div className="flex flex-wrap gap-3">
          {entries.map(({ tracker, ladder }) => (
            <RankStack
              key={tracker.id}
              tracker={tracker}
              ladder={ladder}
              onOpen={() => router.push(`/trackers/${tracker.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
