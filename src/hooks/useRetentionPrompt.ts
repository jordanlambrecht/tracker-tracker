// src/hooks/useRetentionPrompt.ts
//
// The ONE source of truth for "has the first-run retention prompt been
// answered". The prompt dialog and the dashboard's retention banner both read
// this query, so answering the prompt updates every surface immediately. A
// server-rendered prop cannot do that: it is frozen at page load, and the
// banner it fed appeared right after the user answered, until the next reload.

import { useQuery } from "@tanstack/react-query"

export const RETENTION_PROMPT_KEY = ["retention-prompt"] as const

export interface RetentionPromptState {
  prompted: boolean
}

export function useRetentionPromptState() {
  return useQuery({
    queryKey: RETENTION_PROMPT_KEY,
    queryFn: async ({ signal }): Promise<RetentionPromptState> => {
      const res = await fetch("/api/settings/retention-prompt", { signal })
      if (!res.ok) throw new Error(`Retention prompt check failed: ${res.status}`)
      return (await res.json()) as RetentionPromptState
    },
    // The answer only changes through this app's own prompt, which writes the
    // cache directly on save, so there is nothing to poll for.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}
