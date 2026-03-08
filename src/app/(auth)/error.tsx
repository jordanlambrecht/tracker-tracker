"use client"
// src/app/(auth)/error.tsx
import { useEffect } from "react"
import { ErrorDisplay } from "@/components/ui/ErrorDisplay"

export default function AuthError({
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
