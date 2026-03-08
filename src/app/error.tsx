"use client"
// src/app/error.tsx

import Link from "next/link"
import { useEffect } from "react"

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e1a] px-4">
      <div className="w-full max-w-md rounded-lg border border-[rgba(239,68,68,0.2)] bg-[#0f1424] p-8">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-[#ef4444]">
          Runtime Error
        </p>
        <h1 className="mb-4 text-xl font-semibold text-[#e2e8f0]">
          Something went wrong
        </h1>
        <pre className="mb-6 overflow-x-auto rounded border border-[rgba(148,163,184,0.1)] bg-[#080c16] p-3 font-mono text-xs text-[#94a3b8]">
          {error.message || "An unexpected error occurred."}
        </pre>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded border border-[rgba(0,212,255,0.3)] bg-[rgba(0,212,255,0.08)] px-4 py-2 text-sm text-[#00d4ff] transition-colors hover:bg-[rgba(0,212,255,0.15)]"
          >
            Try Again
          </button>
          <Link
            href="/login"
            className="rounded border border-[rgba(148,163,184,0.15)] px-4 py-2 text-sm text-[#94a3b8] transition-colors hover:text-[#e2e8f0]"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
