// src/components/layout/AuthShell.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { HamburgerIcon } from "@/components/ui/Icons"
import { useLocalStorage } from "@/hooks/useLocalStorage"

export function AuthShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const isMobileRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const mobile = mq.matches
    setIsMobile(mobile)
    isMobileRef.current = mobile

    if (mobile) setCollapsed(true)

    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      isMobileRef.current = e.matches
      if (e.matches) setCollapsed(true)
    }
    mq.addEventListener("change", handler)
    setMounted(true)
    return () => mq.removeEventListener("change", handler)
  }, [setCollapsed])

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [setCollapsed])

  const effectiveCollapsed = !mounted || collapsed
  const showHamburger = isMobile || effectiveCollapsed

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobile && !effectiveCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={toggle}
          aria-hidden="true"
        />
      )}
      <Sidebar collapsed={effectiveCollapsed} onToggle={toggle} isMobile={isMobile} />
      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 relative themed-scrollbar">
        {showHamburger && (
          <button
            type="button"
            onClick={toggle}
            className="fixed top-4 left-4 z-50 p-2 bg-base text-secondary hover:text-primary transition-colors duration-150 cursor-pointer nm-raised-sm rounded-nm-sm"
            aria-label="Open sidebar"
          >
            <HamburgerIcon width="20" height="20" />
          </button>
        )}
        <div
          className="transition-[padding-left] duration-300 ease-in-out"
          style={{
            paddingTop: isMobile ? "3rem" : undefined,
            paddingLeft: !isMobile && effectiveCollapsed ? "3rem" : undefined,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
