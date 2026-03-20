"use client"
// src/app/(auth)/trackers/[id]/error.tsx

import { useEffect } from "react"
import { ErrorDisplay } from "@/components/ui/ErrorDisplay"

export default function TrackerDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <ErrorDisplay message={error.message} onRetry={reset} linkHref="/" linkText="Go Home" />
}
