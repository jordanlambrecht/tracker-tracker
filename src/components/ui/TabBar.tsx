// src/components/ui/TabBar.tsx

"use client"

import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

interface Tab<T extends string> {
  key: T
  label: string
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[]
  activeTab: T
  onChange: (tab: T) => void
}

function TabBar<T extends string>({ tabs, activeTab, onChange }: TabBarProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const button = buttonRefs.current.get(activeTab)
    if (!container || !button) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()

    setPill({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    })
  }, [activeTab, tabs])

  return (
    <div
      ref={containerRef}
      className="relative flex gap-1.5 p-2 bg-control-bg nm-inset rounded-nm-md"
      role="tablist"
    >
      {/* Sliding pill */}
      {pill && (
        <div
          className="absolute nm-raised-sm bg-raised pointer-events-none rounded-nm-sm"
          style={{
            top: 8,
            bottom: 8,
            left: pill.left,
            width: pill.width,
            transition: "left 250ms cubic-bezier(0.4, 0, 0.2, 1), width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {tabs.map((tab) => (
        <button
          key={tab.key}
          ref={(el) => {
            if (el) buttonRefs.current.set(tab.key, el)
          }}
          type="button"
          onClick={() => onChange(tab.key)}
          className={clsx(
            "relative z-10 flex-1 px-4 py-2.5 text-sm font-sans font-medium transition-colors duration-150 cursor-pointer rounded-nm-sm",
            activeTab === tab.key
              ? "text-primary"
              : "text-tertiary hover:text-secondary",
          )}
          aria-selected={activeTab === tab.key}
          role="tab"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export { TabBar }
export type { TabBarProps }
