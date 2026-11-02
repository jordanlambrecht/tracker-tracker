// src/components/layout/OutboundProvider.tsx
//
// Functions: OutboundProvider, useOutboundDisabled

"use client"

import { createContext, type ReactNode, useContext } from "react"

// The browser cannot read the server's runtime environment, so the auth layout
// reads DISABLE_OUTBOUND_REQUESTS and hands the answer down. False outside it.
const OutboundDisabledContext = createContext(false)

export function OutboundProvider({
  disabled,
  children,
}: {
  disabled: boolean
  children: ReactNode
}) {
  return (
    <OutboundDisabledContext.Provider value={disabled}>{children}</OutboundDisabledContext.Provider>
  )
}

/** True when the browser must not contact outside services for this instance either. */
export function useOutboundDisabled(): boolean {
  return useContext(OutboundDisabledContext)
}
