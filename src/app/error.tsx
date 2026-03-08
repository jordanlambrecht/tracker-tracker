"use client"
// src/app/error.tsx
import { useEffect } from "react"
import { ErrorDisplay } from "@/components/ui/ErrorDisplay"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <ErrorDisplay message={error.message} onRetry={reset} linkHref="/login" linkText="Back to Login" />
}
