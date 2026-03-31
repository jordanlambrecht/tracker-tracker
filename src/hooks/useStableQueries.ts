// src/hooks/useStableQueries.ts

"use client"

import { type UseQueryOptions, type UseQueryResult, useQueries } from "@tanstack/react-query"
import { useRef } from "react"

/**
 * Wraps useQueries with referential stability — returns the same array ref
 * when no individual query's .data or .status has changed. Prevents downstream
 * useMemo invalidation from useQueries returning a new array ref every render.
 */
export function useStableQueries<TData = unknown>(options: {
  queries: UseQueryOptions<TData>[]
}): UseQueryResult<TData>[] {
  const results = useQueries(options)
  const prevRef = useRef(results)

  if (
    prevRef.current.length === results.length &&
    prevRef.current.every(
      (prev, i) => prev.data === results[i].data && prev.status === results[i].status
    )
  ) {
    return prevRef.current
  }

  prevRef.current = results
  return results
}
