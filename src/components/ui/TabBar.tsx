// src/components/ui/TabBar.tsx
"use client"

import { cva } from "class-variance-authority"
import clsx from "clsx"
import { useEffect, useRef, useState } from "react"

const track = cva("relative flex bg-control-bg", {
  variants: {
    size: {
      default: "nm-inset gap-2 p-2 rounded-nm-md",
      compact: "nm-inset-sm gap-0.5 p-1 w-fit rounded-nm-sm",
    },
  },
  defaultVariants: { size: "default" },
})

const pill = cva("absolute z-[1] bg-raised pointer-events-none", {
  variants: {
    size: {
      default: "top-2.5 bottom-2.5 nm-raised-sm rounded-[4px]",
      compact:
        "top-[3px] bottom-1 bg-overlay rounded-[4px] ring-1 ring-black/[0.15] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.4),-2px_0_4px_-2px_rgba(0,0,0,0.4)]",
    },
  },
  defaultVariants: { size: "default" },
})

const tab = cva("relative z-10 transition-colors duration-150 cursor-pointer rounded-nm-sm", {
  variants: {
    size: {
      default: "flex-1 px-4 py-2.5 text-sm font-sans font-medium",
      compact: "px-2.5 py-1 text-xs font-mono",
    },
    active: {
      true: "text-primary font-semibold",
      false: "text-tertiary hover:text-secondary",
    },
  },
  defaultVariants: { size: "default", active: false },
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Tab<T extends string> {
  key: T
  label: string
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[]
  activeTab: T
  onChange: (tab: T) => void
  compact?: boolean
}

function TabBar<T extends string>({ tabs, activeTab, onChange, compact = false }: TabBarProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [pillPos, setPillPos] = useState<{ left: number; width: number } | null>(null)

  const size = compact ? "compact" : "default"

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs don't need to be deps
  useEffect(() => {
    const container = containerRef.current
    const button = buttonRefs.current.get(activeTab)
    if (!container || !button) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()

    setPillPos({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    })
  }, [activeTab, tabs])

  return (
    <div ref={containerRef} className={track({ size })} role="tablist">
      {/* Sliding pill */}
      {pillPos && (
        <div
          className={pill({ size })}
          style={{
            left: pillPos.left,
            width: pillPos.width,
            transition:
              "left 250ms cubic-bezier(0.4, 0, 0.2, 1), width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {tabs.map((t) => (
        <button
          key={t.key}
          ref={(el) => {
            if (el) buttonRefs.current.set(t.key, el)
          }}
          type="button"
          onClick={() => onChange(t.key)}
          className={clsx(tab({ size, active: activeTab === t.key }))}
          aria-selected={activeTab === t.key}
          role="tab"
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export type { TabBarProps }
export { TabBar }
