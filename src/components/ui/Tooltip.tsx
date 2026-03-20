// src/components/ui/Tooltip.tsx
//
// Functions: Tooltip

"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { DocsEntry } from "@/lib/constants"

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
  docs?: DocsEntry
}

function Tooltip({ content, children, className, docs }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeout = useRef<ReturnType<typeof setTimeout>>(null)

  function show() {
    if (timeout.current) clearTimeout(timeout.current)
    setVisible(true)
  }

  function hide() {
    timeout.current = setTimeout(() => setVisible(false), 150)
  }

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current)
    },
    []
  )

  useEffect(() => {
    if (!visible || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, left: rect.left })
  }, [visible])

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: tooltip trigger delegates interaction to children */}
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={className}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className="fixed z-[9999] px-3 py-2 text-[11px] font-sans font-normal normal-case tracking-normal text-secondary leading-relaxed whitespace-normal bg-overlay nm-raised-sm rounded-nm-sm"
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {content}
            {docs?.description && !docs.href && (
              <p className="mt-1.5 pt-1.5 border-t border-border text-muted text-[10px]">
                {docs.description}
              </p>
            )}
            {docs?.href && (
              <a
                href={docs.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1.5 pt-1.5 border-t border-border text-accent hover:underline text-[10px]"
              >
                {docs.description ?? "Learn more"} →
              </a>
            )}
          </div>,
          document.body
        )}
    </>
  )
}

export { Tooltip }
