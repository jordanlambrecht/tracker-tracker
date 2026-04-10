// src/components/layout/AuthShell.tsx
"use client"

import clsx from "clsx"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { WhatsNew } from "@/components/layout/WhatsNew"
import { BackToTop } from "@/components/ui/BackToTop"
import { HamburgerIcon } from "@/components/ui/Icons"
import { useLocalStorage } from "@/hooks/useLocalStorage"

export function AuthShell({ children }: { children: ReactNode }) {
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

  const mainRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  // Scroll main content to top on route change (main is the scroll container, not window)
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger — we intentionally re-run on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  const effectiveCollapsed = !mounted || collapsed
  const showHamburger = isMobile || effectiveCollapsed

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobile && (
        <div
          className={clsx(
            "fixed inset-0 z-20 bg-black/50 transition-opacity duration-300 ease-in-out",
            effectiveCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          onClick={toggle}
          aria-hidden="true"
        />
      )}
      <Sidebar collapsed={effectiveCollapsed} onToggle={toggle} isMobile={isMobile} />
      <main
        ref={mainRef}
        className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 relative themed-scrollbar"
      >
        {showHamburger && (
          <button
            type="button"
            onClick={toggle}
            className="fixed top-4 left-4 z-40 p-2 bg-base text-secondary hover:text-primary transition-colors duration-150 cursor-pointer nm-raised-sm rounded-nm-sm"
            aria-label="Open sidebar"
          >
            <HamburgerIcon width="20" height="20" />
          </button>
        )}
        <div
          className={clsx(
            "transition-[padding-left] duration-300 ease-in-out min-h-full",
            isMobile && "pt-12",
            !isMobile && effectiveCollapsed && "pl-12"
          )}
        >
          {children}
          <footer className="flex justify-center pt-16 pb-8">
            <Image
              src="/img/trackerTracker_logo_nm.svg"
              alt="Tracker Tracker"
              width={240}
              height={73}
              className="select-none pointer-events-none"
              draggable={false}
              priority
            />
          </footer>
        </div>
        <BackToTop scrollRef={mainRef} />
      </main>
      <WhatsNew />
    </div>
  )
}
